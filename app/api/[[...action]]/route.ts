import { ZodError, z } from "zod";
import { session, member, authAction, profileAction } from "../../../server/account";
import {
  catalog,
  courseSummary,
  config,
  first,
  Problem,
  requireValue,
  rows,
  run,
  now,
} from "../../../server/db";
import {
  overview,
  lessonView,
  exerciseView,
  markLesson,
  markExercise,
  beginQuiz,
  answerQuiz,
  saveFeedback,
  notebook,
} from "../../../server/study";
import {
  adminReports,
  adminGrades,
  adminLesson,
  writeModule,
  writeLesson,
  userList,
  manageUser,
  saveEducation,
} from "../../../server/admin";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ action?: string[] }> };
const json = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
async function handle(req: Request, ctx: Ctx) {
  try {
    const [part, id, sub] = (await ctx.params).action || [];
    const post = req.method === "POST";
    const body = async () => {
      const origin = req.headers.get("origin"),
        site = config().SITE_URL;
      const permitted = [new URL(req.url).origin, site];
      if (origin && !permitted.includes(origin) && new URL(origin).host !== req.headers.get("host"))
        throw new Problem(403, "Origem não autorizada.");
      if (!req.headers.get("content-type")?.startsWith("application/json"))
        throw new Problem(415, "Formato de requisição inválido.");
      const raw = await req.text();
      if (raw.length > 430000) throw new Problem(413, "Conteúdo muito grande.");
      return z.record(z.any()).parse(JSON.parse(raw));
    };
    if (!post && part === "access" && ["sites", "email"].includes(id)) {
      const back = new URL(req.url).searchParams.get("to") === "cadastro" ? "/cadastro" : "/login";
      return new Response(null, {
        status: 302,
        headers: { Location: back, "Cache-Control": "no-store" },
      });
    }
    if (!post && part === "formation") return json(await courseSummary());
    if (!post && part === "catalog") return json(await catalog());
    if (!post && part === "session") return json(await session());
    if (post && part === "auth")
      return json(await authAction(id, await body(), req.headers.get("x-logicalab-return-origin")));
    const u = await member(part === "admin");
    if (part === "admin") {
      if (!post) {
        if (id === "reports") return json(await adminReports());
        if (id === "grades") return json(await adminGrades(sub));
        if (id === "users") {
          if (sub) {
            const person = requireValue(
              await first(
                "SELECT u.id,u.email,u.role,u.active,u.created,u.last_seen,p.* FROM users u JOIN profiles p ON p.user_id=u.id WHERE u.id=?",
                sub
              )
            );
            return json({ person, history: await overview(sub) });
          }
          return json(await userList());
        }
        if (id === "content") return json(await catalog(true));
        if (id === "lesson") return json(await adminLesson(sub));
        if (id === "feedback")
          return json(
            await rows(
              "SELECT f.scope,f.ratings,f.improve,f.difficulty,f.created,l.title FROM feedback f LEFT JOIN lessons l ON l.id=f.lesson_id ORDER BY f.created DESC"
            )
          );
      } else {
        const b = await body();
        if (id === "users") return json(await manageUser(u, sub, b));
        if (id === "education") return json(await saveEducation(b));
        if (id === "module") return json(await writeModule(sub || "", b));
        if (id === "lesson") return json(await writeLesson(sub || "", b));
        if (id === "delete") {
          const target = z.enum(["lesson", "module"]).parse(b.kind),
            key = z.string().min(1).max(110).parse(b.id);
          if (b.confirm !== key) throw new Problem(422, "Confirme a exclusão.");
          await run(
            "DELETE FROM " + (target === "module" ? "modules" : "lessons") + " WHERE id=?",
            key
          );
          return json({ message: "Conteúdo excluído." });
        }
      }
    }
    if (!post) {
      if (part === "study") return json(await overview(u.id));
      if (part === "lesson") return json(await lessonView(u.id, id));
      if (part === "exercise") return json(await exerciseView(u.id, id));
      if (part === "notebook") {
        const data = await notebook(u.id, id);
        return new Response(JSON.stringify(data, null, 2), {
          headers: {
            "Content-Type": "application/x-ipynb+json",
            "Content-Disposition":
              'attachment; filename="logicalab-' + id.replace(/[^\w-]/g, "") + '.ipynb"',
            "Cache-Control": "no-store",
          },
        });
      }
    } else {
      const b = await body();
      if (part === "profile") return json(await profileAction(id, b, u));
      if (part === "lesson" && sub === "complete") return json(await markLesson(u.id, id));
      if (part === "lesson" && sub === "time") {
        const s = z.number().int().min(1).max(60).parse(b.seconds);
        await run(
          "UPDATE progress SET seconds=seconds+?,accessed=? WHERE user_id=? AND lesson_id=?",
          s,
          now(),
          u.id,
          id
        );
        return json({ saved: true });
      }
      if (part === "exercise") return json(await markExercise(u.id, id, sub === "complete"));
      if (part === "quiz" && sub === "start")
        return json(await beginQuiz(u.id, id, b.retake === true));
      if (part === "quiz" && sub === "answer") return json(await answerQuiz(u.id, id, b));
      if (part === "feedback") return json(await saveFeedback(u.id, b));
      if (part === "notifications") {
        await run("UPDATE notifications SET seen=1 WHERE user_id=?", u.id);
        return json({ saved: true });
      }
    }
    throw new Problem(404, "Página não encontrada.");
  } catch (e) {
    if (e instanceof Problem) return json({ error: e.message }, e.status);
    if (e instanceof ZodError)
      return json(
        {
          error:
            "Confira o campo " +
            String(e.issues[0]?.path[0] || "informado") +
            ". " +
            (e.issues[0]?.message?.match(/[áãéíçõ]/i)
              ? e.issues[0].message
              : "O valor informado é inválido."),
        },
        422
      );
    if (e instanceof SyntaxError) return json({ error: "Os dados enviados são inválidos." }, 400);
    console.error("Falha interna da LógicaLab", e instanceof Error ? e.name : "Erro");
    return json({ error: "Não foi possível concluir esta operação. Tente novamente." }, 500);
  }
}
export const GET = handle;
export const POST = handle;
