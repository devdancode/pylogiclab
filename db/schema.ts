import {
  sqliteTable,
  integer,
  text,
  primaryKey,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";

const id = () => text("id").primaryKey();
const required = (name: string) => text(name).notNull();
export const users = sqliteTable("users", {
  id: id(),
  email: required("email").unique(),
  supabaseId: text("supabase_id").unique(),
  role: required("role").default("aluno"),
  active: integer("active").notNull().default(1),
  verified: integer("verified").notNull().default(1),
  created: required("created"),
  lastSeen: required("last_seen"),
  consent: required("consent"),
});
const userRef = () =>
  text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" });
export const profiles = sqliteTable("profiles", {
  user: userRef().primaryKey(),
  name: required("name"),
  phone: required("phone"),
  birth: required("birth"),
  city: required("city"),
  state: required("state"),
  education: required("education"),
  area: required("area").default(""),
  experience: required("experience"),
  goal: required("goal").default(""),
  weekly: required("weekly").default(""),
  photo: required("photo").default(""),
  onboarded: integer("onboarded").notNull().default(0),
});
export const educationOptions = sqliteTable("education_options", {
  name: required("name").primaryKey(),
  position: integer("position").notNull(),
});
export const courses = sqliteTable("courses", {
  id: id(),
  title: required("title"),
  description: required("description"),
});
export const modules = sqliteTable("modules", {
  id: id(),
  courseId: text("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  title: required("title"),
  description: required("description"),
  position: integer("position").notNull(),
  icon: required("icon"),
  level: required("level"),
  category: required("category"),
  published: integer("published").notNull().default(1),
});
const moduleRef = () =>
  text("module_id")
    .notNull()
    .references(() => modules.id, { onDelete: "cascade" });
export const lessons = sqliteTable("lessons", {
  id: id(),
  module: moduleRef(),
  title: required("title"),
  description: required("description"),
  objective: required("objective"),
  theory: required("theory"),
  code: required("code"),
  explanation: required("explanation"),
  note: required("note"),
  material: required("material"),
  minutes: integer("minutes").notNull(),
  position: integer("position").notNull(),
  published: integer("published").notNull().default(1),
});
const lessonRef = () =>
  text("lesson_id")
    .notNull()
    .references(() => lessons.id, { onDelete: "cascade" });
export const exercises = sqliteTable("exercises", {
  id: id(),
  lesson: lessonRef(),
  title: required("title"),
  prompt: required("prompt"),
  objective: required("objective"),
  level: required("level"),
  input: required("input"),
  output: required("output"),
  hint: required("hint"),
  solution: required("solution"),
  explanation: required("explanation"),
  url: required("url").default(""),
});
export const questions = sqliteTable("questions", {
  id: id(),
  lesson: lessonRef(),
  prompt: required("prompt"),
  explanation: required("explanation"),
  position: integer("position").notNull(),
});
export const alternatives = sqliteTable("alternatives", {
  id: id(),
  question: text("question_id")
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" }),
  label: required("label"),
  correct: integer("correct").notNull(),
  position: integer("position").notNull(),
});
export const progress = sqliteTable(
  "progress",
  {
    user: userRef(),
    lesson: lessonRef(),
    accessed: required("accessed"),
    completed: text("completed"),
    seconds: integer("seconds").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.user, t.lesson] })],
);
export const exerciseProgress = sqliteTable(
  "exercise_progress",
  {
    user: userRef(),
    exercise: text("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    accessed: required("accessed"),
    completed: text("completed"),
  },
  (t) => [primaryKey({ columns: [t.user, t.exercise] })],
);
export const quizAttempts = sqliteTable(
  "quiz_attempts",
  {
    id: id(),
    user: userRef(),
    lesson: lessonRef(),
    number: integer("number").notNull(),
    snapshot: required("snapshot"),
    answers: required("answers").default("[]"),
    score: integer("score").notNull().default(0),
    started: required("started"),
    finished: text("finished"),
  },
  (t) => [uniqueIndex("attempt_number").on(t.user, t.lesson, t.number)],
);
export const feedback = sqliteTable(
  "feedback",
  {
    id: id(),
    user: userRef(),
    scope: required("scope"),
    lesson: text("lesson_id").references(() => lessons.id, { onDelete: "cascade" }),
    ratings: required("ratings"),
    improve: required("improve"),
    difficulty: required("difficulty"),
    created: required("created"),
  },
  (t) => [uniqueIndex("feedback_scope").on(t.user, t.scope)],
);
export const achievements = sqliteTable("achievements", {
  id: id(),
  title: required("title"),
  description: required("description"),
});
export const userAchievements = sqliteTable(
  "user_achievements",
  {
    user: userRef(),
    achievement: text("achievement_id")
      .notNull()
      .references(() => achievements.id, { onDelete: "cascade" }),
    created: required("created"),
  },
  (t) => [primaryKey({ columns: [t.user, t.achievement] })],
);
export const notifications = sqliteTable(
  "notifications",
  {
    id: id(),
    user: userRef(),
    message: required("message"),
    created: required("created"),
    seen: integer("seen").notNull().default(0),
  },
  (t) => [index("user_notes").on(t.user, t.created)],
);
