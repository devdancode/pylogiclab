"use client";

import { Fragment, useState } from "react";
import { dateBR } from "../lib/model";
import {
  formatGrade,
  type GradeSummary,
  type ParticipantGrade,
  type QuizGrade,
} from "../lib/grades";
import { Empty, Icon, Loading, Notice, useRemote } from "./common";

const pageSize = 10;
function searchKey(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR").trim();
}

function QuizDetails({ participant }: { participant: ParticipantGrade }) {
  const { value, error } = useRemote("admin/grades/" + encodeURIComponent(participant.id));
  if (error) return <Notice text={error} />;
  if (!value) return <Loading />;
  const quizzes: QuizGrade[] = value;
  if (!quizzes.length) return <Empty text="Nenhum quiz publicado na trilha." />;

  return (
    <div className="grade-breakdown">
      <h3>Notas de {participant.name}</h3>
      <div
        className="grade-quiz-scroll"
        role="region"
        aria-label={"Quizzes de " + participant.name}
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th scope="col">Quiz da aula</th>
              <th scope="col">Melhor nota</th>
              <th scope="col">Tentativas</th>
            </tr>
          </thead>
          <tbody>
            {quizzes.map((quiz) => (
              <tr key={quiz.id}>
                <td>
                  {quiz.title}
                  <small>
                    Módulo {quiz.modulePosition} · {quiz.moduleTitle}
                  </small>
                </td>
                <td className="grade-number">
                  {quiz.best === null ? (
                    <span className="grade-pending">Pendente</span>
                  ) : (
                    formatGrade(quiz.best)
                  )}
                </td>
                <td>
                  {quiz.attempts.length > 0 && (
                    <details className="grade-attempts">
                      <summary>
                        {quiz.attempts.length}{" "}
                        {quiz.attempts.length === 1 ? "concluída" : "concluídas"}
                      </summary>
                      <ul>
                        {quiz.attempts.map((a) => (
                          <li key={a.number}>
                            <b>
                              Tentativa {a.number} · {formatGrade(a.grade)}
                            </b>
                            <small>
                              {a.correct}/{a.total} acertos · {dateBR(a.date, true)}
                            </small>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                  {quiz.inProgress && <small>Em andamento</small>}
                  {!quiz.inProgress && !quiz.attempts.length && (
                    <span className="grade-pending">Nenhuma</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Gradebook({ summary }: { summary: GradeSummary }) {
  const { value, error } = useRemote("admin/grades");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const participants: ParticipantGrade[] = value ?? [];
  const needle = searchKey(query);
  const filtered = participants.filter((p) => searchKey(p.name).includes(needle));
  const start = page * pageSize;
  return (
    <section id="notas" className="panel gradebook" aria-labelledby="gradebook-title">
      <div className="grade-heading">
        <div>
          <h2 id="gradebook-title">Notas dos participantes</h2>
          <p>
            A nota geral é a média das melhores notas dos quizzes respondidos, de 0 a 10. Ela é
            parcial até a conclusão de todos os quizzes publicados.
          </p>
        </div>
        <div className="class-grade">
          <span>Média geral da turma</span>
          <strong>
            {formatGrade(summary.classGrade)} <small>/ 10</small>
          </strong>
          <small>
            {summary.evaluated}{" "}
            {summary.evaluated === 1 ? "participante com nota" : "participantes com nota"}
          </small>
        </div>
      </div>
      {error ? (
        <Notice text={error} />
      ) : !value ? (
        <Loading />
      ) : !participants.length ? (
        <Empty text="Ainda não há participantes matriculados." />
      ) : (
        <>
          <div className="grade-tools">
            <label className="search">
              <Icon name="search" size={16} />
              <input
                aria-label="Buscar participante por nome"
                placeholder="Buscar participante por nome"
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                  setOpenId(null);
                }}
              />
            </label>
            <small>
              {summary.quizCount}{" "}
              {summary.quizCount === 1 ? "quiz publicado" : "quizzes publicados"}
            </small>
          </div>
          {filtered.length ? (
            <div className="grade-table-scroll">
              <table className="grade-table">
                <thead>
                  <tr>
                    <th scope="col">Participante</th>
                    <th scope="col">Quizzes concluídos</th>
                    <th scope="col">Nota geral</th>
                    <th scope="col">Situação</th>
                    <th scope="col">
                      <span className="sr-only">Detalhes</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(start, start + pageSize).map((p) => {
                    const open = openId === p.id;
                    const final = p.overall !== null && p.answered === summary.quizCount;
                    const state =
                      p.overall === null ? "Sem avaliação" : final ? "Final" : "Parcial";
                    const detailId = "grade-detail-" + p.id;
                    return (
                      <Fragment key={p.id}>
                        <tr className={open ? "grade-selected" : undefined}>
                          <th scope="row">{p.name}</th>
                          <td>
                            {p.answered} de {summary.quizCount}
                          </td>
                          <td className="grade-number">
                            <b>{formatGrade(p.overall)}</b>
                          </td>
                          <td>
                            <span
                              className={
                                "grade-status" +
                                (final ? " final" : p.overall !== null ? " partial" : "")
                              }
                            >
                              {state}
                            </span>
                          </td>
                          <td>
                            <button
                              className="text-link grade-toggle"
                              type="button"
                              aria-expanded={open}
                              aria-controls={open ? detailId : undefined}
                              aria-label={(open ? "Ocultar notas de " : "Ver notas de ") + p.name}
                              onClick={() => setOpenId(open ? null : p.id)}
                            >
                              {open ? "Ocultar" : "Ver notas"}{" "}
                              <Icon name={open ? "down" : "next"} size={14} />
                            </button>
                          </td>
                        </tr>
                        {open && (
                          <tr>
                            <td id={detailId} className="grade-detail-cell" colSpan={5}>
                              <QuizDetails participant={p} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty text="Nenhum participante corresponde à busca." />
          )}
          {filtered.length > pageSize && (
            <nav className="grade-pages" aria-label="Páginas do relatório de notas">
              <span>
                {start + 1}–{Math.min(start + pageSize, filtered.length)} de {filtered.length}{" "}
                participantes
              </span>
              <button
                className="btn ghost compact"
                type="button"
                disabled={page === 0}
                onClick={() => {
                  setPage(page - 1);
                  setOpenId(null);
                }}
              >
                Anterior
              </button>
              <button
                className="btn ghost compact"
                type="button"
                disabled={start + pageSize >= filtered.length}
                onClick={() => {
                  setPage(page + 1);
                  setOpenId(null);
                }}
              >
                Próxima
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
