export type Row = Record<string, any>;
export type Module = {
  id: string;
  title: string;
  description: string;
  position: number;
  icon: string;
  category: string;
  level: string;
  published: number;
  lessons: LessonSummary[];
};
export type LessonSummary = {
  id: string;
  module_id: string;
  title: string;
  description: string;
  minutes: number;
  position: number;
  published: number;
};
export const categories = ["Fundamentos", "Estruturas", "Projeto final"];
export const experiences = ["Nunca programei", "Iniciante", "Intermediário", "Avançado"];
export const states =
  "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
export const weeklyOptions = ["Até 1 hora", "2 a 3 horas", "4 a 6 horas", "Mais de 6 horas"];
export const dimensions = [
  "Facilidade de navegação",
  "Clareza das explicações",
  "Qualidade dos exercícios",
  "Organização dos conteúdos",
  "Utilidade do conteúdo",
];
export function percentage(value: number, total: number) {
  return total ? Math.round((100 * value) / total) : 0;
}
export function dateBR(value: string, withTime = false) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    ...(withTime ? { timeStyle: "short" as const } : {}),
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}
export const publicMaterial = "https://docs.python.org/pt-br/3/tutorial/";
