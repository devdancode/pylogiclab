export type GradeSummary = {
  quizCount: number;
  evaluated: number;
  classGrade: number | null;
};

export type ParticipantGrade = {
  id: string;
  name: string;
  answered: number;
  overall: number | null;
};

export type GradedAttempt = {
  number: number;
  correct: number;
  total: number;
  grade: number;
  date: string;
};

export type QuizGrade = {
  id: string;
  title: string;
  moduleTitle: string;
  modulePosition: number;
  best: number | null;
  inProgress: boolean;
  attempts: GradedAttempt[];
};

const localGrade = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});

export function formatGrade(value: number | null) {
  return value === null ? "—" : localGrade.format(value);
}
