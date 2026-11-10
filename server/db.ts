import { env } from "cloudflare:workers";
import curriculum from "../content/curriculum.json";
import type { Module, Row } from "../lib/model";
export const db = () => {
  if (!env.DB) throw new Error("Binding DB indisponível");
  return env.DB;
};
export const config = () =>
  env as Cloudflare.Env & {
    ADMIN_EMAIL?: string;
    COLAB_GITHUB_BASE?: string;
    SUPABASE_URL?: string;
    SUPABASE_PUBLISHABLE_KEY?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
    SITE_URL?: string;
    VERCEL_SITE_URL?: string;
  };
export const now = () => new Date().toISOString();
export const stmt = (sql: string, ...args: any[]) =>
  db()
    .prepare(sql)
    .bind(...args);
export const rows = async <T = Row>(sql: string, ...args: any[]): Promise<T[]> =>
  (await stmt(sql, ...args).all<T>()).results;
export const first = async (sql: string, ...args: any[]): Promise<Row | null> =>
  stmt(sql, ...args).first<Row>();
export const run = (sql: string, ...args: any[]) => stmt(sql, ...args).run();
export class Problem extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
export function requireValue<T>(x: T | null | undefined, message = "Conteúdo não encontrado."): T {
  if (x == null) throw new Problem(404, message);
  return x;
}
const defaultEducation = [
  "Ensino fundamental",
  "Ensino médio",
  "Curso técnico",
  "Ensino superior em andamento",
  "Ensino superior completo",
  "Pós-graduação",
  "Outra",
];
const badges = [
  ["primeiro", "Primeiro passo", "Conclua sua primeira aula."],
  ["persistente", "Persistente", "Conclua cinco aulas."],
  ["logico", "Pensamento lógico", "Acerte todas as questões de um quiz."],
  ["python", "Python iniciante", "Conclua os módulos de fundamentos."],
];
function insertRows(table: string, data: Row[]) {
  if (!data.length) throw new Error("Seed vazio: " + table);
  const cols = Object.keys(data[0]);
  return stmt(
    "INSERT OR IGNORE INTO " +
      table +
      " (" +
      cols.join(",") +
      ") SELECT " +
      cols.map((k) => "json_extract(value,'$." + k + "')").join(",") +
      " FROM json_each(?)",
    JSON.stringify(data)
  );
}
export async function seed() {
  if (await first("SELECT id FROM courses WHERE id='python'")) return;
  const modules: Row[] = [],
    lessons: Row[] = [],
    exercises: Row[] = [],
    questions: Row[] = [],
    alternatives: Row[] = [];
  (curriculum as Row[]).forEach((m, i) => {
    const module_id = "m" + (i + 1);
    modules.push({
      id: module_id,
      course_id: "python",
      title: m.title,
      description: m.description,
      position: i + 1,
      icon: m.icon,
      level: m.level,
      category: i < 5 ? "Fundamentos" : i < 9 ? "Estruturas" : "Projeto final",
    });
    m.lessons.forEach((l: Row, j: number) => {
      const id = module_id + "-a" + (j + 1);
      lessons.push({
        id,
        module_id,
        title: l.title,
        description: l.description,
        objective: l.objective,
        theory: l.theory,
        code: l.code,
        explanation: l.explanation,
        note: l.note,
        material: l.material,
        minutes: l.minutes,
        position: j + 1,
      });
      exercises.push({ id: id + "-ex", lesson_id: id, ...l.exercise });
      l.quiz.forEach((q: Row, k: number) => {
        const qid = id + "-q" + (k + 1);
        questions.push({
          id: qid,
          lesson_id: id,
          prompt: q.prompt,
          explanation: q.explanation,
          position: k + 1,
        });
        q.options.forEach((label: string, n: number) =>
          alternatives.push({
            id: qid + "-" + n,
            question_id: qid,
            label,
            correct: Number(n === q.answer),
            position: n,
          })
        );
      });
    });
  });
  // The course marker and all seed data become visible in one transaction.
  await db().batch([
    stmt(
      "INSERT OR IGNORE INTO courses VALUES (?,?,?)",
      "python",
      "Lógica de programação com Python",
      "Do primeiro algoritmo ao projeto final."
    ),
    insertRows("modules", modules),
    insertRows("lessons", lessons),
    insertRows("exercises", exercises),
    insertRows("questions", questions),
    insertRows("alternatives", alternatives),
    insertRows(
      "education_options",
      defaultEducation.map((name, position) => ({ name, position }))
    ),
    insertRows(
      "achievements",
      badges.map(([id, title, description]) => ({ id, title, description }))
    ),
  ]);
}
export async function catalog(all = false): Promise<Module[]> {
  await seed();
  const [mods, lessons] = await Promise.all([
    rows("SELECT * FROM modules " + (all ? "" : "WHERE published=1") + " ORDER BY position,id"),
    rows(
      "SELECT l.id,l.module_id,l.title,l.description,l.minutes,l.position,l.published FROM lessons l JOIN modules m ON m.id=l.module_id " +
        (all ? "" : "WHERE l.published=1 AND m.published=1") +
        " ORDER BY l.position,l.id"
    ),
  ]);
  return mods.map((m) => ({
    ...m,
    lessons: lessons.filter((l) => l.module_id === m.id),
  })) as Module[];
}
export async function courseSummary() {
  const modules = await catalog();
  const count = await first(
    "SELECT count(*) n FROM exercises e JOIN lessons l ON l.id=e.lesson_id JOIN modules m ON m.id=l.module_id WHERE l.published=1 AND m.published=1"
  );
  return { modules, exerciseCount: Number(count?.n || 0) };
}
export async function lesson(id: string) {
  return requireValue(
    await first(
      "SELECT l.* FROM lessons l JOIN modules m ON m.id=l.module_id WHERE l.id=? AND l.published=1 AND m.published=1",
      id
    )
  );
}
export async function exercise(id: string) {
  return requireValue(
    await first(
      "SELECT e.* FROM exercises e JOIN lessons l ON l.id=e.lesson_id JOIN modules m ON m.id=l.module_id WHERE e.id=? AND l.published=1 AND m.published=1",
      id
    )
  );
}
