import { z } from "zod";
import { catalog, config, db, first, now, Problem, requireValue, rows, run, stmt } from "./db";
import { questions } from "./study";
import { categories, dimensions, percentage, type Row } from "../lib/model";
const bounded = (size = 300) => z.string().trim().max(size);
const title = bounded(160).min(1);
const pos = z.coerce.number().int().min(1).max(9999);
const link = z
  .string()
  .max(1500)
  .refine((x) => !x || /^https:\/\//.test(x), "Use um endereço HTTPS.");
const moduleSchema = z.object({
  title,
  description: bounded(800),
  position: pos,
  icon: bounded(30),
  level: bounded(60),
  category: z.string().refine((x) => categories.includes(x)),
  published: z.coerce.number().int().min(0).max(1),
});
const exerciseSchema = z.object({
  id: bounded(100).optional(),
  title,
  prompt: bounded(12000).min(1),
  objective: bounded(1500),
  level: bounded(60),
  input: bounded(4000),
  output: bounded(4000),
  hint: bounded(4000),
  solution: bounded(16000),
  explanation: bounded(6000),
  url: link.default(""),
});
const questionSchema = z
  .object({
    id: bounded(100).optional(),
    prompt: title.or(bounded(1500).min(1)),
    explanation: bounded(4000).min(1),
    options: z.array(bounded(1000).min(1)).min(2).max(8),
    answer: z.number().int().nonnegative(),
  })
  .refine((q) => q.answer < q.options.length, "Selecione a resposta correta.");
const lessonSchema = z.object({
  module_id: title,
  title,
  description: bounded(1000),
  objective: bounded(2000),
  theory: bounded(24000).min(1),
  code: bounded(12000),
  explanation: bounded(6000),
  note: bounded(3000),
  material: link,
  minutes: z.coerce.number().int().min(1).max(600),
  position: pos,
  published: z.coerce.number().int().min(0).max(1),
  exercises: z.array(exerciseSchema).max(12),
  quiz: z.array(questionSchema).max(16),
});
function upsert(table: string, record: Row, id: string) {
  const keys = Object.keys(record);
  return stmt(
    "INSERT INTO " +
      table +
      " (id," +
      keys.join(",") +
      ") VALUES (" +
      ["id", ...keys].map(() => "?").join(",") +
      ") ON CONFLICT(id) DO UPDATE SET " +
      keys.map((k) => k + "=excluded." + k).join(","),
    id,
    ...Object.values(record),
  );
}
export async function adminLesson(id: string) {
  const l = requireValue(await first("SELECT * FROM lessons WHERE id=?", id));
  const [ex, qs] = await Promise.all([
    rows("SELECT * FROM exercises WHERE lesson_id=? ORDER BY rowid", id),
    questions(id),
  ]);
  return {
    ...l,
    exercises: ex,
    quiz: qs.map((q) => ({
      ...q,
      options: q.options.map((a) => a.label),
      answer: q.options.findIndex((a) => a.correct),
    })),
  };
}
export async function writeModule(id: string, b: Row) {
  const parsed = moduleSchema.parse(b);
  if (id) requireValue(await first("SELECT id FROM modules WHERE id=?", id));
  const key = id || "m-" + crypto.randomUUID();
  await upsert("modules", { course_id: "python", ...parsed }, key).run();
  return { id: key, message: "Módulo salvo." };
}
export async function writeLesson(id: string, b: Row) {
  const p = lessonSchema.parse(b);
  requireValue(await first("SELECT id FROM modules WHERE id=?", p.module_id));
  if (id) requireValue(await first("SELECT id FROM lessons WHERE id=?", id));
  const key = id || "a-" + crypto.randomUUID();
  const { exercises, quiz, ...base } = p;
  const ops = [upsert("lessons", base, key)];
  const [prevEx, prevQ] = await Promise.all([
    rows("SELECT id FROM exercises WHERE lesson_id=?", key),
    rows("SELECT id FROM questions WHERE lesson_id=?", key),
  ]);
  const keep = (existing: Row[], candidate?: string) =>
    candidate && existing.some((x) => x.id === candidate) ? candidate : crypto.randomUUID();
  const exKeys = new Set<string>(),
    qKeys = new Set<string>();
  for (const { id: old, ...data } of exercises) {
    const exId = keep(prevEx, old);
    if (exKeys.has(exId)) throw new Problem(422, "Exercício duplicado.");
    exKeys.add(exId);
    ops.push(upsert("exercises", { lesson_id: key, ...data }, exId));
  }
  for (const [i, q] of quiz.entries()) {
    const qId = keep(prevQ, q.id);
    if (qKeys.has(qId)) throw new Problem(422, "Questão duplicada.");
    qKeys.add(qId);
    ops.push(
      upsert(
        "questions",
        { lesson_id: key, prompt: q.prompt, explanation: q.explanation, position: i + 1 },
        qId,
      ),
      stmt("DELETE FROM alternatives WHERE question_id=?", qId),
    );
    const alts = q.options.map((label, n) => ({
      id: qId + "-" + n,
      label,
      correct: Number(n === q.answer),
      position: n,
    }));
    ops.push(
      stmt(
        "INSERT INTO alternatives SELECT json_extract(value,'$.id'),?,json_extract(value,'$.label'),json_extract(value,'$.correct'),json_extract(value,'$.position') FROM json_each(?)",
        qId,
        JSON.stringify(alts),
      ),
    );
  }
  for (const x of prevEx)
    if (!exKeys.has(x.id))
      ops.push(stmt("DELETE FROM exercises WHERE id=? AND lesson_id=?", x.id, key));
  for (const q of prevQ)
    if (!qKeys.has(q.id))
      ops.push(stmt("DELETE FROM questions WHERE id=? AND lesson_id=?", q.id, key));
  await db().batch(ops);
  if (!id && p.published)
    await run(
      "INSERT OR IGNORE INTO notifications (id,user_id,message,created) SELECT id||?,id,?,? FROM users WHERE active=1",
      "/nova/" + key,
      "Uma nova aula foi publicada: " + p.title + ".",
      now(),
    );
  return { message: "Aula salva.", id: key };
}
export async function userList() {
  return rows(
    "SELECT u.id,u.email,u.role,u.active,u.created,u.last_seen,p.name,p.phone,p.city,p.state,p.education,p.experience,(SELECT COUNT(*) FROM progress x JOIN lessons l ON l.id=x.lesson_id JOIN modules m ON m.id=l.module_id WHERE x.user_id=u.id AND x.completed IS NOT NULL AND l.published=1 AND m.published=1) done FROM users u JOIN profiles p ON p.user_id=u.id ORDER BY u.created DESC",
  );
}
export async function manageUser(actor: Row, id: string, b: Row) {
  const u = requireValue(await first("SELECT * FROM users WHERE id=?", id));
  const role = z.enum(["admin", "aluno", "instrutor"]).parse(b.role),
    active = z.coerce.number().int().min(0).max(1).parse(b.active);
  if (
    (id === actor.id || u.email === config().ADMIN_EMAIL?.toLowerCase()) &&
    (role !== "admin" || !active)
  )
    throw new Problem(422, "Mantenha ativa a conta responsável pela administração.");
  await run("UPDATE users SET role=?,active=? WHERE id=?", role, active, id);
  return { message: "Acesso atualizado." };
}
export async function saveEducation(b: Row) {
  const list = z.array(bounded(100).min(2)).min(1).max(30).parse(b.names);
  if (new Set(list).size !== list.length) throw new Problem(422, "Remova as opções repetidas.");
  await db().batch([
    stmt("DELETE FROM education_options"),
    ...list.map((x, i) => stmt("INSERT INTO education_options VALUES (?,?)", x, i)),
  ]);
  return { message: "Escolaridades atualizadas." };
}
export async function adminReports() {
  const [mods, users, progress, practice, attempts, feedback] = await Promise.all([
    catalog(),
    rows(
      "SELECT u.id,u.created,u.last_seen,p.city,p.state,p.birth,p.experience FROM users u JOIN profiles p ON p.user_id=u.id",
    ),
    rows("SELECT user_id,lesson_id,accessed,completed FROM progress"),
    rows("SELECT count(*) n,sum(completed IS NOT NULL) completed FROM exercise_progress"),
    rows("SELECT snapshot,answers,score FROM quiz_attempts WHERE finished IS NOT NULL"),
    rows(
      "SELECT f.scope,f.ratings,l.title FROM feedback f LEFT JOIN lessons l ON l.id=f.lesson_id",
    ),
  ]);
  const grouped = (keys: string[]) =>
    Array.from(keys.reduce((m, x) => m.set(x, (m.get(x) || 0) + 1), new Map<string, number>()))
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value }));
  const lessons = mods.flatMap((x) => x.lessons),
    ids = new Set(lessons.map((l) => l.id)),
    valid = progress.filter((p) => ids.has(p.lesson_id));
  const done = valid.filter((p) => p.completed).length,
    cutoff = new Date(Date.now() - 14 * 864e5).toISOString(),
    today = new Date();
  const age = (s: string) => {
    const b = new Date(s + "T12:00:00Z");
    let n = today.getUTCFullYear() - b.getUTCFullYear();
    if (today.toISOString().slice(5, 10) < s.slice(5)) n--;
    return n < 18
      ? "Até 17 anos"
      : n < 25
      ? "18–24"
      : n < 35
      ? "25–34"
      : n < 50
      ? "35–49"
      : "50 ou mais";
  };
  const errors = new Map<string, { label: string; total: number; miss: number }>();
  let quizTotal = 0,
    quizScore = 0;
  for (const a of attempts) {
    const q = JSON.parse(a.snapshot) as Row[],
      ans = JSON.parse(a.answers) as Row[];
    quizTotal += q.length;
    quizScore += a.score;
    for (const [i, item] of ans.entries()) {
      const v = errors.get(q[i].id) || { label: q[i].prompt, total: 0, miss: 0 };
      v.total++;
      if (!item.correct) v.miss++;
      errors.set(q[i].id, v);
    }
  }
  const courseRatings = feedback.map((f) => JSON.parse(f.ratings) as number[]);
  const rating = courseRatings.length
    ? Number(
        (courseRatings.flat().reduce((a, b) => a + b, 0) / (courseRatings.length * 5)).toFixed(1),
      )
    : null;
  const averages = dimensions.map((label, i) => ({
    label,
    value: courseRatings.length
      ? Number((courseRatings.reduce((s, r) => s + r[i], 0) / courseRatings.length).toFixed(1))
      : 0,
  }));
  const byLesson = new Map<string, number[]>();
  feedback.forEach((f) => {
    const label = f.title || "Curso completo";
    byLesson.set(label, [...(byLesson.get(label) || []), ...(JSON.parse(f.ratings) as number[])]);
  });
  return {
    metrics: {
      users: users.length,
      active: users.filter((x) => x.last_seen >= new Date(Date.now() - 30 * 864e5).toISOString())
        .length,
      modules: mods.length,
      lessons: lessons.length,
      exercises:
        (
          await first(
            "SELECT COUNT(*) n FROM exercises e JOIN lessons l ON l.id=e.lesson_id JOIN modules m ON m.id=l.module_id WHERE l.published=1 AND m.published=1",
          )
        )?.n || 0,
      completion: percentage(done, users.length * lessons.length),
      quiz: percentage(quizScore, quizTotal),
      rating,
      accessed: valid.length,
      done,
      practice: practice[0]?.completed || 0,
      practiceOpened: practice[0]?.n || 0,
      attempts: attempts.length,
      feedback: feedback.length,
    },
    periods: grouped(users.map((x) => x.created.slice(0, 7))),
    cities: grouped(users.map((x) => x.city + " / " + x.state)),
    experience: grouped(users.map((x) => x.experience)),
    ages: grouped(users.map((x) => age(x.birth))),
    usability: averages,
    lessonRatings: Array.from(byLesson, ([label, s]) => ({
      label,
      value: Number((s.reduce((x, y) => x + y, 0) / s.length).toFixed(1)),
    })),
    modules: mods.map((m) => {
      const ids = new Set(m.lessons.map((x) => x.id)),
        byUser = new Map<string, Row[]>();
      for (const v of valid.filter((x) => ids.has(x.lesson_id)))
        byUser.set(v.user_id, [...(byUser.get(v.user_id) || []), v]);
      const started = [...byUser.values()],
        completed = started.filter(
          (p) => m.lessons.length && p.filter((x) => x.completed).length === m.lessons.length,
        ).length;
      return {
        label: m.title,
        started: started.length,
        completed,
        inactive: started
          .filter((p) => p.some((x) => !x.completed) || p.length < m.lessons.length)
          .filter((p) => p.every((x) => x.accessed < cutoff)).length,
        value: percentage(completed, started.length),
      };
    }),
    errors: [...errors.values()]
      .filter((x) => x.miss > 0)
      .sort((a, b) => b.miss / b.total - a.miss / a.total)
      .map((x) => ({ ...x, value: percentage(x.miss, x.total) })),
  };
}
