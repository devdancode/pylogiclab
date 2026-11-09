import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import {
  gradeSummaryQuery,
  participantGradesQuery,
  participantQuizzesQuery,
  groupQuizGrades,
} from "../server/grading.ts";

function fixture(t) {
  const db = new DatabaseSync(":memory:");
  t.after(() => db.close());
  db.exec("PRAGMA foreign_keys = ON");
  const dir = new URL("../drizzle/", import.meta.url);
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    db.exec(readFileSync(new URL(file, dir), "utf8"));
  }
  db.exec(`INSERT INTO courses VALUES ('python','Python','');
    INSERT INTO modules VALUES ('m','python','Fundamentos','',1,'brain','Iniciante','Fundamentos',1)`);
  function lesson(id, position) {
    db.prepare(
      `INSERT INTO lessons(id,module_id,title,description,objective,theory,code,explanation,note,material,minutes,position)
      VALUES (?,'m',?,'','','','','','','',10,?)`,
    ).run(id, id, position);
    db.prepare("INSERT INTO questions VALUES (?,?,?,'',1)").run(id + "-question", id, "Pergunta");
  }
  function enroll(id, name) {
    db.prepare(
      "INSERT INTO users(id,email,created,last_seen,consent) VALUES (?,?,'2026-01-01','2026-01-01','v1')",
    ).run(id, id + "@example.test");
    db.prepare(
      "INSERT INTO profiles(user_id,name,phone,birth,city,state,education,experience) VALUES (?,?,'00000000000','2000-01-01','Cidade','SP','Ensino médio','Iniciante')",
    ).run(id, name);
  }
  function attempt(id, quiz, number, score, total, finished = true) {
    const snapshot = JSON.stringify(Array.from({ length: total }, (_, i) => ({ id: "q" + i })));
    db.prepare(
      `INSERT INTO quiz_attempts(id,user_id,lesson_id,number,snapshot,score,started,finished)
      VALUES (?,?,?,?,?,?,'2026-11-01T09:00:00Z',?)`,
    ).run(
      id + quiz + number,
      id,
      quiz,
      number,
      snapshot,
      score,
      finished ? "2026-11-01T09:05:00Z" : null,
    );
  }
  return {
    db,
    lesson,
    enroll,
    attempt,
    summary: () => ({ ...db.prepare(gradeSummaryQuery).get() }),
    participants: () => db.prepare(participantGradesQuery).all(),
    quizzes: (id) => groupQuizGrades(db.prepare(participantQuizzesQuery).all(id)),
  };
}

test("a nota distingue ausência e zero e usa a melhor proporção de cada quiz", (t) => {
  const f = fixture(t);
  f.lesson("a", 1);
  f.lesson("b", 2);
  f.lesson("c", 3);
  f.enroll("ana", "Mesmo Nome");
  f.enroll("bia", "Mesmo Nome");
  f.enroll("rui", "Outra Pessoa");
  f.attempt("ana", "a", 1, 2, 2);
  f.attempt("ana", "a", 2, 3, 4); // More raw points, lower percentage.
  f.attempt("ana", "a", 3, 1, 1, false);
  f.attempt("ana", "b", 1, 1, 4);
  f.attempt("bia", "a", 1, 0, 2);
  f.attempt("rui", "b", 1, 1, 2, false);
  const students = new Map(f.participants().map((p) => [p.id, p]));
  assert.equal(students.get("ana").overall, 6.25);
  assert.equal(students.get("ana").answered, 2);
  assert.equal(students.get("bia").overall, 0);
  assert.equal(students.get("rui").overall, null);
  assert.deepEqual(f.summary(), { quizCount: 3, evaluated: 2, classGrade: 3.125 });
  const [a, b, c] = f.quizzes("ana");
  assert.equal(a.best, 10);
  assert.equal(a.inProgress, true);
  assert.deepEqual(
    a.attempts.map((x) => [x.number, x.correct, x.total, x.grade]),
    [
      [2, 3, 4, 7.5],
      [1, 2, 2, 10],
    ],
  );
  assert.equal(b.best, 2.5);
  assert.equal(c.best, null);
  assert.deepEqual(c.attempts, []);
  f.attempt("ana", "c", 1, 1, 1);
  const final = f.participants().find((p) => p.id === "ana");
  assert.equal(final.answered, f.summary().quizCount);
  assert.equal(final.overall, 7.5);
});

test("quizzes ocultos ou removidos deixam de contar e o histórico usa o denominador original", (t) => {
  const f = fixture(t);
  f.lesson("visivel", 1);
  f.lesson("oculta", 2);
  f.lesson("sem-quiz", 3);
  f.enroll("aluno", "Participante");
  f.attempt("aluno", "visivel", 1, 1, 3);
  f.attempt("aluno", "oculta", 1, 2, 2);
  f.attempt("aluno", "sem-quiz", 1, 2, 2);
  f.db.exec(
    "UPDATE lessons SET published=0 WHERE id='oculta'; DELETE FROM questions WHERE lesson_id='sem-quiz';",
  );
  assert.equal(f.summary().quizCount, 1);
  assert.equal(f.quizzes("aluno")[0].attempts[0].total, 3);
  assert.equal(f.participants()[0].overall, 10 / 3);
  f.db.exec("UPDATE modules SET published=0");
  assert.deepEqual(f.summary(), { quizCount: 0, evaluated: 0, classGrade: null });
  assert.equal(f.participants()[0].overall, null);
  assert.deepEqual(f.quizzes("aluno"), []);
});

test("uma turma ainda sem participantes tem média pendente", (t) => {
  const f = fixture(t);
  f.lesson("a", 1);
  assert.deepEqual(f.participants(), []);
  assert.deepEqual(f.summary(), { quizCount: 1, evaluated: 0, classGrade: null });
});
