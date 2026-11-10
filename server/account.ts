import { cookies } from "next/headers";
import { z } from "zod";
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
    if (res.status >= 500)
      throw new Problem(503, "O serviço de acesso está temporariamente indisponível.");
    if (res.status === 429) throw new Problem(429, "Muitas tentativas. Aguarde alguns minutos.");
    if (
      data.error_code === "email_address_not_authorized" ||
      data.code === "email_address_not_authorized"
    )
      throw new Problem(
        503,
        "O serviço de e-mail da plataforma ainda não pode enviar a confirmação para este endereço. Procure a coordenação."
      );
    if ((data.error_code || data.code) === "invalid_credentials")
      throw new Problem(401, "E-mail ou senha incorretos.");
    if ((data.error_code || data.code) === "email_not_confirmed")
      throw new Problem(403, "Confirme seu e-mail antes de entrar.");
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
  jar.set(tokenName, tokens.access_token, { ...options, maxAge: tokens.expires_in || 3600 });
  jar.set(refreshName, tokens.refresh_token, { ...options, maxAge: 30 * 86400 });
}
export async function clearTokens() {
  const c = await cookies();
  c.delete(tokenName);
  c.delete(refreshName);
}
// A verified password identity can claim its previous enrollment exactly once.
async function enrollmentId(subject: string, email: string) {
  const key = "sb:" + subject;
  const existing = await first("SELECT id FROM users WHERE id=? OR supabase_id=?", key, subject);
  if (existing) return String(existing.id);
  const linked = await first(
    "UPDATE users SET supabase_id=? WHERE email=? AND id LIKE 'sites:%' AND verified=1 AND supabase_id IS NULL RETURNING id",
    subject,
    email
  );
  if (linked) return String(linked.id);
  const concurrent = await first("SELECT id FROM users WHERE supabase_id=?", subject);
  return concurrent ? String(concurrent.id) : key;
}
export async function identity(renew = false): Promise<Identity | null> {
  const jar = await cookies();
  const access = jar.get(tokenName)?.value;
  const refresh = jar.get(refreshName)?.value;
  if (!hasProvider() || (!access && !refresh)) return null;
  const lookup = async (token: string) => {
    try {
      return await provider("user", undefined, token, "GET");
    } catch (e) {
      if (!(e instanceof Problem) || e.status !== 400) throw e;
      return null;
    }
  };
  let user = access ? await lookup(access) : null;
  if (!user && renew && refresh) {
    try {
      const t = await provider("token?grant_type=refresh_token", { refresh_token: refresh });
      await setTokens(t);
      user = await lookup(t.access_token);
    } catch (e) {
      if (!(e instanceof Problem) || e.status !== 400) throw e;
      await clearTokens();
    }
  }
  if (!user?.id || !user.email_confirmed_at || !user.email) return null;
  const email = mail.parse(user.email);
  return {
    id: await enrollmentId(user.id, email),
    email,
    name: user.user_metadata?.enrollment?.name || "",
    metadata: user.user_metadata,
  };
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
  if (u && !profile && u.metadata?.enrollment && u.metadata?.consent) {
    await enroll(u, u.metadata.enrollment, true);
    profile = await account(u);
  }
  if (profile?.active === 0)
    throw new Problem(403, "Sua conta está desativada. Procure a coordenação do projeto.");
  if (profile) await run("UPDATE users SET last_seen=? WHERE id=?", now(), u!.id);
  return {
    identity: u ? { name: u.name, email: u.email } : null,
    profile,
    consented: u?.metadata?.consent === true,
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
export async function authAction(action: string, b: Row, requestedOrigin: string | null = null) {
  const c = config();
  const origin =
    requestedOrigin && requestedOrigin === c.VERCEL_SITE_URL ? requestedOrigin : c.SITE_URL;
  if (action === "signup") {
    const email = mail.parse(b.email),
      password = passwordSchema.parse(b.password);
    if (password !== b.confirm) throw new Problem(422, "As senhas não coincidem.");
    if (b.consent !== true) throw new Problem(422, "Aceite os termos e a política de privacidade.");
    if (!origin) throw new Problem(503, "A URL de confirmação precisa ser configurada.");
    const result = await provider(
      "signup?redirect_to=" + encodeURIComponent(origin + "/confirmar"),
      {
        email,
        password,
        data: { consent: true },
      }
    );
    if (result.access_token && result.refresh_token) {
      await setTokens(result);
      return { next: "/dashboard" };
    }
    return {
      message:
        "Confira sua caixa de entrada e a pasta de spam para confirmar o cadastro. Se já tem uma conta, entre com sua senha.",
      pending: true,
    };
  }
  if (action === "enroll") {
    const u = await identity(true);
    if (!u) throw new Problem(401, "Confirme seu e-mail e entre para concluir a matrícula.");
    if (!(await account(u))) await enroll(u, b, b.consent === true || u.metadata?.consent === true);
    return { next: "/dashboard" };
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
    if (!origin) throw new Problem(503, "A URL de recuperação precisa ser configurada.");
    await provider("recover?redirect_to=" + encodeURIComponent(origin + "/nova-senha"), {
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
    return { next: b.type === "recovery" ? "/nova-senha" : "/dashboard" };
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
    if (!u) throw new Problem(401, "Entre pelo link de recuperação ou pela sua conta de e-mail.");
    const password = passwordSchema.parse(b.password);
    if (password !== b.confirm) throw new Problem(422, "As senhas não coincidem.");
    await provider("user", { password }, (await cookies()).get(tokenName)?.value, "PUT");
    return { message: "Senha atualizada." };
  }
  if (action === "logout") {
    const token = (await cookies()).get(tokenName)?.value;
    if (hasProvider() && token) await provider("logout", undefined, token).catch(() => {});
    await clearTokens();
    (await cookies()).delete("ll_native");
    return { next: "/" };
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
    const token = (await cookies()).get(tokenName)?.value;
    if (!token) throw new Problem(401, "Entre novamente para excluir sua conta.");
    if (config().SUPABASE_SERVICE_ROLE_KEY) {
      const verified = await provider("user", undefined, token, "GET");
      await provider(
        "admin/users/" + encodeURIComponent(verified.id),
        undefined,
        undefined,
        "DELETE",
        true
      );
    } else {
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
    await run("DELETE FROM users WHERE id=?", u.id);
    await clearTokens();
    return { next: "/" };
  }
  throw new Problem(404, "Ação não encontrada.");
}
