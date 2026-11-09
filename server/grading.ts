import type { QuizGrade } from "../lib/grades";

// The current course determines which quizzes count. Each attempt is graded
// against the questions saved at submission, even if the content later changes.
const publishedQuizzes = `
  SELECT l.id, l.title, m.title AS moduleTitle,
         m.position AS modulePosition, l.position AS lessonPosition, m.id AS moduleId
  FROM lessons l JOIN modules m ON m.id = l.module_id
  WHERE l.published = 1 AND m.published = 1
    AND EXISTS (SELECT 1 FROM questions q WHERE q.lesson_id = l.id)
`;
const attemptGrade = "10.0 * a.score / NULLIF(json_array_length(a.snapshot), 0)";
const gradeAverages = `
  WITH quizzes AS (${publishedQuizzes}), best_per_quiz AS (
    SELECT a.user_id, a.lesson_id, MAX(${attemptGrade}) AS grade
    FROM quiz_attempts a JOIN quizzes q ON q.id = a.lesson_id
    WHERE a.finished IS NOT NULL AND json_array_length(a.snapshot) > 0
    GROUP BY a.user_id, a.lesson_id
  ), per_participant AS (
    SELECT user_id, AVG(grade) AS overall, COUNT(*) AS answered
    FROM best_per_quiz GROUP BY user_id
  )
`;

export const gradeSummaryQuery = `${gradeAverages}
  SELECT (SELECT COUNT(*) FROM quizzes) AS quizCount,
         COUNT(*) AS evaluated, AVG(overall) AS classGrade
  FROM per_participant JOIN profiles p ON p.user_id = per_participant.user_id
`;
export const participantGradesQuery = `${gradeAverages}
  SELECT p.user_id AS id, p.name, COALESCE(g.answered, 0) AS answered, g.overall
  FROM profiles p LEFT JOIN per_participant g ON g.user_id = p.user_id
  ORDER BY p.name COLLATE NOCASE, p.user_id
`;
export const participantQuizzesQuery = `
  WITH quizzes AS (${publishedQuizzes})
  SELECT q.id, q.title, q.moduleTitle, q.modulePosition,
         a.number, a.finished, a.score AS correct, json_array_length(a.snapshot) AS total,
         CASE WHEN a.finished IS NOT NULL THEN ${attemptGrade} END AS grade
  FROM quizzes q LEFT JOIN quiz_attempts a ON a.lesson_id = q.id AND a.user_id = ?
  ORDER BY q.modulePosition, q.moduleId, q.lessonPosition, q.id, a.number DESC
`;

export type QuizAttemptRow = {
  id: string;
  title: string;
  moduleTitle: string;
  modulePosition: number;
  number: number | null;
  finished: string | null;
  correct: number | null;
  total: number | null;
  grade: number | null;
};

export function groupQuizGrades(records: QuizAttemptRow[]): QuizGrade[] {
  const grouped = new Map<string, QuizGrade>();
  for (const row of records) {
    let quiz = grouped.get(row.id);
    if (!quiz) {
      quiz = {
        id: row.id,
        title: row.title,
        moduleTitle: row.moduleTitle,
        modulePosition: row.modulePosition,
        best: null,
        inProgress: false,
        attempts: [],
      };
      grouped.set(row.id, quiz);
    }
    if (row.number === null) continue;
    if (row.finished === null) {
      quiz.inProgress = true;
      continue;
    }
    if (row.grade === null || row.correct === null || row.total === null) continue;
    quiz.best = quiz.best === null ? row.grade : Math.max(quiz.best, row.grade);
    quiz.attempts.push({
      number: row.number,
      correct: row.correct,
      total: row.total,
      grade: row.grade,
      date: row.finished,
    });
  }
  return Array.from(grouped.values());
}
