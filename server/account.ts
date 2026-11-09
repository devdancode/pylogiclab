import { cookies } from "next/headers";
import { z } from "zod";
import { getChatGPTUser } from "../app/chatgpt-auth";
import { config, db, first, now, Problem, rows, run, seed, stmt } from "./db";
import { experiences, states, weeklyOptions, type Row } from "../lib/model";

const str = (n: number) => z.string().trim().max(n);
export const profileShape = z.object({
  name: str(120).min(2, "Informe seu nome completo."),
  phone: str(24).refine(
    (x) =>
      /^\+?[\d\s().-]+$/.test(x) &&
      x.replace(/\D/g, "").length >= 10 &&
      x.replace(/\D/g, "").length <= 15,
    "Informe um telefone com DDD."
  ),
  birth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(
      (x) =>
        x >= "1900-01-01" &&
        x <= now().slice(0, 10) &&
        !isNaN(Date.parse(x)) &&
        new Date(x).toISOString().slice(0, 10) === x,
      "Confira a data de nascimento."
    ),
  city: str(90).min(2),
  state: z.string().refine((x) => states.includes(x)),
  education: str(100).min(1),
  area: str(160).default(""),
  experience: z.string().refine((x) => experiences.includes(x)),
  goal: str(800).default(""),
  photo: z
    .string()
    .max(150000)
    .refine((x) => !x || /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(x))
    .default(""),
});
export const passwordSchema = z
  .string()
  .min(8, "Use pelo menos oito caracteres.")
  .max(128)
  .regex(/[a-zA-ZÀ-ÿ]/, "Inclua uma letra.")
  .regex(/\d/, "Inclua um número.");
const mail = z
  .string()
  .trim()
  .email("Confira seu e-mail.")
  .max(254)
  .transform((x) => x.toLowerCase());
export const hasProvider = () =>
  Boolean(config().SUPABASE_URL && config().SUPABASE_PUBLISHABLE_KEY);
type Identity = {
  id: string;
  email: string;
  name: string;
  metadata?: Row;
  mode: "sites" | "email";
};
async function provider(
  path: string,
  body?: unknown,
  token?: string,
  method = "POST",
  admin = false
) {
  const c = config();
  if (!hasProvider()) throw new Problem(503, "O acesso por e-mail ainda não está configurado.");
  const key = admin ? c.SUPABASE_SERVICE_ROLE_KEY! : c.SUPABASE_PUBLISHABLE_KEY!;
  const res = await fetch(c.SUPABASE_URL!.replace(/\/$/, "") + "/auth/v1/" + path, {
    method,
    headers: {
      apikey: key,
      ...(token ? { Authorization: "Bearer " + token } : {}),
      "Content-Type": "application/json",
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json<any>().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 429) throw new Problem(429, "Muitas tentativas. Aguarde alguns minutos.");
    if (
      data.error_code === "email_address_not_authorized" ||
      data.code === "email_address_not_authorized"
    )
      throw new Problem(
        503,
        "O envio de e-mail para participantes ainda não foi habilitado. Continue com o ChatGPT para se matricular."
      );
    throw new Problem(
      400,
      "Não foi possível validar os dados. Confira o e-mail, a confirmação da conta e a senha."
    );
  }
  return data;
}
const tokenName = "ll_access",
  refreshName = "ll_refresh";
async function setTokens(tokens: Row) {
  const jar = await cookies();
  const options = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" };
  if (!tokens.access_token || !tokens.refresh_token)
    throw new Problem(400, "A sessão não pôde ser iniciada.");
  jar.set("ll_native", "0", { ...options, maxAge: 30 * 86400 });
  jar.set(tokenName, tokens.access_token, { ...options, maxAge: tokens.expires_in || 3600 });
  jar.set(refreshName, tokens.refresh_token, { ...options, maxAge: 30 * 86400 });
}
export async function clearTokens() {
  const c = await cookies();
  c.delete(tokenName);
  c.delete(refreshName);
}
export async function nativeSelected() {
  if (!hasProvider()) return true;
  const selected = (await cookies()).get("ll_native")?.value;
  if (selected !== undefined) return selected === "1";
  return config().EMAIL_AUTH_PRIMARY !== "1";
}
export async function identity(renew = false): Promise<Identity | null> {
  if (!(await nativeSelected())) {
    const jar = await cookies();
    let token = jar.get(tokenName)?.value;
    if (renew && !token && jar.get(refreshName)?.value) {
      try {
        const t = await provider("token?grant_type=refresh_token", {
          refresh_token: jar.get(refreshName)?.value,
        });
        await setTokens(t);
        token = t.access_token;
      } catch {
        await clearTokens();
      }
    }
    if (token) {
      try {
        const u = await provider("user", undefined, token, "GET");
        if (u.email_confirmed_at)
          return {
            id: "sb:" + u.id,
            email: u.email.toLowerCase(),
            name: u.user_metadata?.enrollment?.name || "",
            metadata: u.user_metadata,
            mode: "email",
          };
      } catch {}
    }
    return null;
  }
  const u = await getChatGPTUser();
  return u
    ? {
        id: "sites:" + u.userId,
        email: u.email.toLowerCase(),
        name: u.fullName || "",
        mode: "sites",
      }
    : null;
}
export async function account(u: Identity) {
  return first(
    "SELECT u.id,u.email,u.role,u.active,u.created,u.last_seen,p.* FROM users u JOIN profiles p ON p.user_id=u.id WHERE u.id=?",
    u.id
  );
}
export async function enroll(u: Identity, data: unknown, consent: boolean) {
  if (!consent)
    throw new Problem(422, "Aceite os termos e a política de privacidade para continuar.");
  const p = profileShape.parse(data);
  await seed();
  if (!(await first("SELECT 1 FROM education_options WHERE name=?", p.education)))
    throw new Problem(422, "Selecione uma escolaridade disponível.");
  const existing = await first("SELECT id FROM users WHERE email=?", u.email);
  if (existing && existing.id !== u.id)
    throw new Problem(409, "Este e-mail já está cadastrado. Entre com a conta original.");
  const ts = now(),
    role = u.email === config().ADMIN_EMAIL?.trim().toLowerCase() ? "admin" : "aluno";
  await db().batch([
    stmt(
      "INSERT INTO users (id,email,role,created,last_seen,consent) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING",
      u.id,
      u.email,
      role,
      ts,
      ts,
      "2026-11-v1 | " + ts
    ),
    stmt(
      "INSERT INTO profiles (user_id,name,phone,birth,city,state,education,area,experience,goal,photo) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO NOTHING",
      u.id,
      p.name,
      p.phone,
      p.birth,
      p.city,
      p.state,
      p.education,
      p.area,
      p.experience,
      p.goal,
      p.photo
    ),
    stmt(
      "INSERT OR IGNORE INTO notifications (id,user_id,message,created) VALUES (?,?,?,?)",
      u.id + "/inicio",
      u.id,
      "Sua trilha está pronta. Comece pelo primeiro módulo.",
      ts
    ),
  ]);
}
export async function session() {
  await seed();
  const u = await identity(true);
  let profile = u ? await account(u) : null;
  if (u && !profile && u.mode === "email" && u.metadata?.enrollment && u.metadata?.consent) {
    await enroll(u, u.metadata.enrollment, true);
    profile = await account(u);
  }
  if (profile?.active === 0)
    throw new Problem(403, "Sua conta está desativada. Procure a coordenação do projeto.");
  if (profile) await run("UPDATE users SET last_seen=? WHERE id=?", now(), u!.id);
  return {
    identity: u ? { name: u.name, email: u.email, mode: u.mode } : null,
    profile,
    provider: !(await nativeSelected()),
    emailAvailable: hasProvider(),
    education: (await rows("SELECT name FROM education_options ORDER BY position,name")).map(
      (x) => x.name
    ),
  };
}
export async function member(admin = false) {
  const u = await identity(true);
  if (!u) throw new Problem(401, "Entre para acessar sua área.");
  const p = await account(u);
  if (!p) throw new Problem(409, "Conclua seu cadastro para continuar.");
  if (!p.active) throw new Problem(403, "Sua conta está desativada.");
  if (admin && p.role !== "admin")
    throw new Problem(403, "Esta área é exclusiva da administração.");
  return p;
}
export async function authAction(action: string, b: Row) {
  if (action === "signup") {
    const profile = profileShape.parse(b);
    if (b.consent !== true) throw new Problem(422, "Aceite os termos e a política de privacidade.");
    if (!(await nativeSelected())) {
      const email = mail.parse(b.email),
        password = passwordSchema.parse(b.password);
      if (password !== b.confirm) throw new Problem(422, "As senhas não coincidem.");
      const origin = config().SITE_URL;
      if (!origin) throw new Problem(503, "A URL de confirmação precisa ser configurada.");
      await provider("signup?redirect_to=" + encodeURIComponent(origin + "/login"), {
        email,
        password,
        data: { enrollment: profile, consent: true },
      });
      return {
        message:
          "Confira sua caixa de entrada para confirmar a conta. Se já confirmou, entre com sua senha.",
        pending: true,
      };
    }
    const u = await identity();
    if (!u) throw new Problem(401, "Identifique-se com sua conta ChatGPT para fazer a matrícula.");
    await enroll(u, profile, true);
    return { next: "/boas-vindas" };
  }
  if (action === "login") {
    const t = await provider("token?grant_type=password", {
      email: mail.parse(b.email),
      password: z.string().max(128).parse(b.password),
    });
    await setTokens(t);
    return { next: "/dashboard" };
  }
  if (action === "recover") {
    if (!hasProvider())
      throw new Problem(400, "A recuperação é feita pelo acesso seguro do ChatGPT.");
    await provider("recover?redirect_to=" + encodeURIComponent(config().SITE_URL + "/nova-senha"), {
      email: mail.parse(b.email),
    });
    return {
      message: "Se o endereço estiver cadastrado, o provedor enviará um link de recuperação.",
    };
  }
  if (action === "verify") {
    if (!["signup", "email", "recovery"].includes(b.type))
      throw new Problem(400, "Tipo de confirmação inválido.");
    const t = await provider("verify", {
      type: b.type,
      token_hash: z.string().min(12).max(512).parse(b.token),
    });
    await setTokens(t);
    return { next: b.type === "recovery" ? "/nova-senha" : "/boas-vindas" };
  }
  if (action === "exchange") {
    const access = z.string().min(15).max(12000).parse(b.access),
      refresh = z.string().min(10).max(2000).parse(b.refresh);
    const u = await provider("user", undefined, access, "GET");
    if (!u.email_confirmed_at) throw new Problem(403, "Confirme o seu e-mail.");
    await setTokens({ access_token: access, refresh_token: refresh, expires_in: 3600 });
    return { next: b.type === "recovery" ? "/nova-senha" : "/dashboard" };
  }
  if (action === "password") {
    const u = await identity(true);
    if (!u || u.mode !== "email")
      throw new Problem(401, "Entre pelo link de recuperação ou pela sua conta de e-mail.");
    const password = passwordSchema.parse(b.password);
    if (password !== b.confirm) throw new Problem(422, "As senhas não coincidem.");
    await provider("user", { password }, (await cookies()).get(tokenName)?.value, "PUT");
    return { message: "Senha atualizada." };
  }
  if (action === "logout") {
    const native = await nativeSelected();
    const token = (await cookies()).get(tokenName)?.value;
    if (hasProvider() && token) await provider("logout", undefined, token).catch(() => {});
    await clearTokens();
    (await cookies()).delete("ll_native");
    return { next: native ? "/signout-with-chatgpt?return_to=%2F" : "/" };
  }
  throw new Problem(404, "Ação não encontrada.");
}
export async function profileAction(action: string, b: Row, u: Row) {
  if (action === "onboard") {
    const exp = z
        .string()
        .refine((x) => experiences.includes(x))
        .parse(b.experience),
      weekly = z
        .string()
        .refine((x) => weeklyOptions.includes(x))
        .parse(b.weekly),
      goal = str(800).parse(b.goal);
    await run(
      "UPDATE profiles SET onboarded=1,experience=?,goal=?,weekly=? WHERE user_id=?",
      exp,
      goal,
      weekly,
      u.id
    );
    return { next: "/curso/modulo/m1" };
  }
  if (action === "update") {
    const p = profileShape.parse(b);
    if (
      !(await first("SELECT 1 FROM education_options WHERE name=?", p.education)) &&
      p.education !== u.education
    )
      throw new Problem(422, "Escolaridade inválida.");
    await run(
      "UPDATE profiles SET name=?,phone=?,birth=?,city=?,state=?,education=?,area=?,experience=?,goal=?,photo=? WHERE user_id=?",
      p.name,
      p.phone,
      p.birth,
      p.city,
      p.state,
      p.education,
      p.area,
      p.experience,
      p.goal,
      p.photo,
      u.id
    );
    return { message: "Perfil atualizado." };
  }
  if (action === "delete") {
    if (b.confirm !== "EXCLUIR") throw new Problem(422, "Digite EXCLUIR para confirmar.");
    if (u.id.startsWith("sb:")) {
      if (config().SUPABASE_SERVICE_ROLE_KEY)
        await provider(
          "admin/users/" + encodeURIComponent(u.id.slice(3)),
          undefined,
          undefined,
          "DELETE",
          true
        );
      else {
        const token = (await cookies()).get(tokenName)?.value;
        const res = await fetch(
          config().SUPABASE_URL!.replace(/\/$/, "") + "/rest/v1/rpc/excluir_minha_conta_logicalab",
          {
            method: "POST",
            headers: {
              apikey: config().SUPABASE_PUBLISHABLE_KEY!,
              Authorization: "Bearer " + token,
              "Content-Type": "application/json",
            },
            body: "{}",
          }
        );
        if (!res.ok)
          throw new Problem(
            503,
            "A exclusão da identidade pelo provedor não pôde ser concluída. Solicite a exclusão à coordenação pelo feedback."
          );
      }
    }
    await run("DELETE FROM users WHERE id=?", u.id);
    await clearTokens();
    return { next: "/" };
  }
  throw new Problem(404, "Ação não encontrada.");
}
