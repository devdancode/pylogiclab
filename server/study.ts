import { buildExerciseNotebook } from "../lib/notebook.mjs";
import curriculum from "../content/curriculum.json";
import { config } from "./db";
import { z } from "zod";
import {
  catalog,
  db,
  exercise,
  first,
  lesson,
  now,
  Problem,
  requireValue,
  rows,
  run,
  stmt,
} from "./db";
import { percentage, type Row } from "../lib/model";

async function notify(uid: string, key: string, message: string) {
  await run(
    "INSERT OR IGNORE INTO notifications (id,user_id,message,created) VALUES (?,?,?,?)",
    uid + "/" + key,
    uid,
    message,
    now()
  );
}
async function award(uid: string, id: string) {
  const time = now();
  await db().batch([
    stmt("INSERT OR IGNORE INTO user_achievements VALUES (?,?,?)", uid, id, time),
    stmt(
      "INSERT OR IGNORE INTO notifications (id,user_id,message,created) SELECT ?,?,'Conquista desbloqueada: '||title,? FROM achievements WHERE id=?",
      uid + "/" + id,
      uid,
      time,
      id
    ),
  ]);
}
export async function overview(uid: string) {
  const [modules, progress, exercises, quizzes, achievements, notes, feedback] = await Promise.all([
    catalog(),
    rows(
      "SELECT p.*,l.title FROM progress p JOIN lessons l ON l.id=p.lesson_id JOIN modules m ON m.id=l.module_id WHERE user_id=? AND l.published=1 AND m.published=1 ORDER BY accessed DESC",
      uid
    ),
    rows(
      "SELECT ep.*,e.title FROM exercise_progress ep JOIN exercises e ON e.id=ep.exercise_id JOIN lessons l ON l.id=e.lesson_id JOIN modules m ON m.id=l.module_id WHERE user_id=? AND l.published=1 AND m.published=1 ORDER BY ep.accessed DESC",
      uid
    ),
    rows(
      "SELECT a.id,a.lesson_id,a.number,a.score,a.started,a.finished,json_array_length(a.snapshot) AS total,l.title FROM quiz_attempts a JOIN lessons l ON l.id=a.lesson_id WHERE user_id=? AND finished IS NOT NULL ORDER BY finished DESC",
      uid
    ),
    rows(
      "SELECT a.*,u.created FROM achievements a LEFT JOIN user_achievements u ON u.achievement_id=a.id AND u.user_id=? ORDER BY a.rowid",
      uid
    ),
    rows(
      "SELECT id,message,created,seen FROM notifications WHERE user_id=? ORDER BY created DESC LIMIT 35",
      uid
    ),
    rows("SELECT scope,ratings,improve,difficulty FROM feedback WHERE user_id=?", uid),
  ]);
  return { modules, progress, exercises, quizzes, achievements, notes, feedback };
}
export async function lessonView(uid: string, id: string) {
  const l = await lesson(id);
  await run(
    "INSERT INTO progress (user_id,lesson_id,accessed) VALUES (?,?,?) ON CONFLICT(user_id,lesson_id) DO UPDATE SET accessed=excluded.accessed",
    uid,
    id,
    now()
  );
  const [ex, questions, p] = await Promise.all([
    rows("SELECT id,title,level FROM exercises WHERE lesson_id=? ORDER BY rowid", id),
    first("SELECT count(*) AS n FROM questions WHERE lesson_id=?", id),
    first("SELECT completed FROM progress WHERE user_id=? AND lesson_id=?", uid, id),
  ]);
  return { ...l, exercises: ex, questions: questions?.n, completed: p?.completed };
}
export async function markLesson(uid: string, id: string) {
  const l = await lesson(id);
  const ts = now();
  await run(
    "INSERT INTO progress (user_id,lesson_id,accessed,completed) VALUES (?,?,?,?) ON CONFLICT(user_id,lesson_id) DO UPDATE SET completed=coalesce(progress.completed,excluded.completed),accessed=excluded.accessed",
    uid,
    id,
    ts,
    ts
  );
  const [mods, done] = await Promise.all([
    catalog(),
    rows("SELECT lesson_id FROM progress WHERE user_id=? AND completed IS NOT NULL", uid),
  ]);
  const ids = new Set(done.map((x) => x.lesson_id));
  const total = mods.flatMap((m) => m.lessons);
  const count = total.filter((x) => ids.has(x.id)).length;
  if (count > 0) await award(uid, "primeiro");
  if (count >= 5) await award(uid, "persistente");
  const mod = mods.find((m) => m.id === l.module_id);
  if (mod && mod.lessons.length && mod.lessons.every((x) => ids.has(x.id)))
    await notify(
      uid,
      "mod/" + mod.id,
      "Você concluiu o módulo " + mod.position + ": " + mod.title + "."
    );
  const basics = mods.filter((m) => m.category === "Fundamentos").flatMap((m) => m.lessons);
  if (basics.length && basics.every((x) => ids.has(x.id))) await award(uid, "python");
  if (percentage(count, total.length) >= 50)
    await notify(uid, "metade", "Você já concluiu metade da trilha!");
  return { completed: true };
}
export async function exerciseView(uid: string, id: string) {
  const e = await exercise(id);
  const p = await first(
    "SELECT * FROM exercise_progress WHERE user_id=? AND exercise_id=?",
    uid,
    id
  );
  const { solution, explanation, ...info } = e;
  // Only published and unmodified course notebooks can use the repository copy.
  const match = /^m(\d+)-a(\d+)-ex$/.exec(id);
  const original =
    match && curriculum[Number(match[1]) - 1]?.lessons[Number(match[2]) - 1]?.exercise;
  const notebookBase = config().COLAB_GITHUB_BASE;
  const matchesContent =
    original &&
    ["title", "prompt", "objective", "input", "output", "hint"].every(
      (key) => e[key] === (original as Row)[key]
    );
  if (!info.url && notebookBase && matchesContent) info.url = notebookBase + "/" + id + ".ipynb";
  return {
    ...info,
    accessed: p?.accessed,
    completed: p?.completed,
    ...(p?.completed ? { solution, explanation } : {}),
  };
}
export async function markExercise(uid: string, id: string, complete: boolean) {
  await exercise(id);
  const time = now();
  await run(
    "INSERT INTO exercise_progress (user_id,exercise_id,accessed,completed) VALUES (?,?,?,?) ON CONFLICT(user_id,exercise_id) DO UPDATE SET accessed=excluded.accessed, completed=coalesce(exercise_progress.completed,excluded.completed)",
    uid,
    id,
    time,
    complete ? time : null
  );
  return exerciseView(uid, id);
}
export async function questions(id: string) {
  const [qs, alts] = await Promise.all([
    rows("SELECT * FROM questions WHERE lesson_id=? ORDER BY position,id", id),
    rows(
      "SELECT a.* FROM alternatives a JOIN questions q ON q.id=a.question_id WHERE q.lesson_id=? ORDER BY a.position,a.id",
      id
    ),
  ]);
  return qs.map((q) => ({
    ...q,
    options: alts
      .filter((a) => a.question_id === q.id)
      .map((a) => ({ id: a.id, label: a.label, correct: !!a.correct })),
  }));
}
function publicAttempt(a: Row) {
  const snapshot = JSON.parse(a.snapshot) as Row[];
  const answers = JSON.parse(a.answers) as Row[];
  const q = snapshot[answers.length];
  return {
    id: a.id,
    number: a.number,
    total: snapshot.length,
    score: a.score,
    answers: answers.map((ans, i) => ({
      ...ans,
      prompt: snapshot[i].prompt,
      explanation: snapshot[i].explanation,
      correctLabel: snapshot[i].options.find((o: Row) => o.correct)?.label,
    })),
    finished: a.finished,
    started: a.started,
    next: q
      ? {
          id: q.id,
          prompt: q.prompt,
          options: q.options.map((o: Row) => ({ id: o.id, label: o.label })),
        }
      : null,
  };
}
export async function beginQuiz(uid: string, lid: string, retake = false) {
  await lesson(lid);
  const current = await first(
    "SELECT * FROM quiz_attempts WHERE user_id=? AND lesson_id=? ORDER BY number DESC LIMIT 1",
    uid,
    lid
  );
  if (current && (!current.finished || !retake)) return publicAttempt(current);
  const snapshot = await questions(lid);
  if (!snapshot.length) throw new Problem(404, "Esta aula ainda não tem quiz.");
  const id = crypto.randomUUID();
  await run(
    "INSERT OR IGNORE INTO quiz_attempts (id,user_id,lesson_id,number,snapshot,started) VALUES (?,?,?,?,?,?)",
    id,
    uid,
    lid,
    Number(current?.number || 0) + 1,
    JSON.stringify(snapshot),
    now()
  );
  return publicAttempt(
    requireValue(
      await first(
        "SELECT * FROM quiz_attempts WHERE user_id=? AND lesson_id=? ORDER BY number DESC LIMIT 1",
        uid,
        lid
      )
    )
  );
}
export async function answerQuiz(uid: string, attempt: string, b: Row) {
  const a = requireValue(
    await first("SELECT * FROM quiz_attempts WHERE user_id=? AND id=?", uid, attempt)
  );
  const snapshot = JSON.parse(a.snapshot) as Row[],
    answers = JSON.parse(a.answers) as Row[];
  if (answers.some((x) => x.qid === b.question)) return publicAttempt(a);
  const q = snapshot[answers.length],
    opt = q?.options.find((o: Row) => o.id === b.option);
  if (a.finished || !q || q.id !== b.question || !opt)
    throw new Problem(409, "A questão mudou. Atualize a página.");
  answers.push({ qid: q.id, option: opt.id, correct: opt.correct });
  const finished = answers.length === snapshot.length ? now() : null;
  await run(
    "UPDATE quiz_attempts SET answers=?,score=score+?,finished=? WHERE id=? AND user_id=? AND json_array_length(answers)=? AND finished IS NULL",
    JSON.stringify(answers),
    Number(opt.correct),
    finished,
    attempt,
    uid,
    answers.length - 1
  );
  const result = publicAttempt(
    requireValue(await first("SELECT * FROM quiz_attempts WHERE id=? AND user_id=?", attempt, uid))
  );
  if (result.finished && result.score === result.total) await award(uid, "logico");
  return result;
}
export async function saveFeedback(uid: string, b: Row) {
  const ratings = z.array(z.number().int().min(1).max(5)).length(5).parse(b.ratings),
    improve = z
      .string()
      .trim()
      .max(2000)
      .parse(b.improve || ""),
    difficulty = z
      .string()
      .trim()
      .max(2000)
      .parse(b.difficulty || "");
  const scope = z
    .string()
    .max(100)
    .parse(b.scope || "curso");
  if (scope !== "curso") await lesson(scope);
  await run(
    "INSERT INTO feedback (id,user_id,scope,lesson_id,ratings,improve,difficulty,created) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(user_id,scope) DO UPDATE SET ratings=excluded.ratings,improve=excluded.improve,difficulty=excluded.difficulty,created=excluded.created",
    crypto.randomUUID(),
    uid,
    scope,
    scope === "curso" ? null : scope,
    JSON.stringify(ratings),
    improve,
    difficulty,
    now()
  );
  return { message: "Sua avaliação foi registrada. Obrigado por participar!" };
}
export async function notebook(uid: string, id: string) {
  const e = await exercise(id);
  await markExercise(uid, id, false);
  return buildExerciseNotebook(e);
}
