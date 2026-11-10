// Only the LógicaLab API and its own session cookies cross the hosting boundary.
const upstreamOrigin = "https://logicalab-pirassununga.endlesssparrow.chatgpt.site";
const sessionCookie = /^ll_(access|refresh)=/;
const groups = new Set([
  "access",
  "formation",
  "catalog",
  "session",
  "auth",
  "study",
  "lesson",
  "quiz",
  "exercise",
  "notebook",
  "admin",
  "profile",
  "feedback",
  "notifications",
]);
const fail = (res, code, message) => res.status(code).json({ error: message });

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "GET" && req.method !== "POST") return fail(res, 405, "Método não permitido.");
  const incoming = new URL(req.url, "https://logicalab.invalid");
  const originalPath = incoming.pathname.startsWith("/api/") ? incoming.pathname.slice(5) : "";
  const captured = incoming.searchParams.get("route") || req.query?.route;
  const route = originalPath && originalPath !== "service" ? originalPath :
    Array.isArray(captured) ? captured.join("/") : captured;
  if (typeof route !== "string") return fail(res, 404, "Recurso não encontrado.");
  let parts;
  try {
    parts = route.split("/").map(decodeURIComponent);
  } catch {
    return fail(res, 404, "Recurso não encontrado.");
  }
  if (
    parts.length > 3 ||
    !groups.has(parts[0]) ||
    parts.some((part) => !/^[A-Za-z0-9_:@.-]{1,200}$/.test(part) || part === "." || part === "..")
  )
    return fail(res, 404, "Recurso não encontrado.");
  const origin = req.headers.origin;
  if (req.method === "POST" && origin && origin !== "https://" + req.headers.host)
    return fail(res, 403, "Origem não autorizada.");
  const headers = new Headers({ Accept: "application/json" });
  const cookie = (req.headers.cookie || "")
    .split(";")
    .map((item) => item.trim())
    .filter((item) => sessionCookie.test(item))
    .join("; ");
  if (cookie) headers.set("Cookie", cookie);
  let body;
  if (req.method === "POST") {
    if (!req.headers["content-type"]?.startsWith("application/json"))
      return fail(res, 415, "Envie os dados em JSON.");
    body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    if (!body || Buffer.byteLength(body) > 430000)
      return fail(res, 413, "Conteúdo inválido ou muito grande.");
    headers.set("Content-Type", "application/json");
    headers.set("Origin", upstreamOrigin);
    if (origin) headers.set("X-Logicalab-Return-Origin", origin);
  }
  const destination = new URL("/api/" + parts.map(encodeURIComponent).join("/"), upstreamOrigin);
  if (parts[0] === "access" && incoming.searchParams.get("to") === "cadastro")
    destination.searchParams.set("to", "cadastro");
  try {
    const reply = await fetch(destination, {
      method: req.method,
      headers,
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(20000),
    });
    if (parts[0] === "access" && reply.status === 302) {
      const location = reply.headers.get("Location");
      if (location === "/login" || location === "/cadastro") return res.redirect(302, location);
    }
    const contentType = reply.headers.get("content-type") || "";
    if (!/^(application\/json|application\/x-ipynb\+json)\b/i.test(contentType))
      return fail(res, 502, "Não foi possível obter uma resposta da plataforma. Tente novamente.");
    for (const key of ["content-type", "content-disposition"]) {
      const value = reply.headers.get(key);
      if (value) res.setHeader(key, value);
    }
    const cookies = reply.headers.getSetCookie().filter((value) => sessionCookie.test(value));
    if (cookies.length) res.setHeader("Set-Cookie", cookies);
    return res.status(reply.status).send(Buffer.from(await reply.arrayBuffer()));
  } catch {
    return fail(res, 502, "O serviço da plataforma está indisponível. Tente novamente.");
  }
}
