"use client";
import React, { useEffect, useState } from "react";
import {
  api,
  Bar,
  Empty,
  Field,
  Icon,
  Loading,
  ModeIcon,
  Notice,
  NumberTag,
  PageTitle,
  PythonCode,
  useRemote,
} from "./common";
import { ProfileFields } from "./account";
import {
  dateBR,
  dimensions,
  percentage,
  type Module,
  type LessonSummary,
  type Row,
} from "../lib/model";
function learning(data: Row) {
  const modules: Module[] = data.modules,
    lessons = modules.flatMap((m) => m.lessons),
    done = new Set<string>(
      data.progress.filter((p: Row) => p.completed).map((p: Row) => p.lesson_id)
    ),
    last = data.progress[0]?.lesson_id,
    next =
      lessons.find((l) => l.id === last && !done.has(l.id)) ||
      lessons.find((l) => !done.has(l.id)) ||
      lessons.at(-1),
    mod = modules.find((x) => x.id === next?.module_id);
  return { modules, lessons, done, next, mod };
}
function Metric({ icon, value, label }: { icon: string; value: string | number; label: string }) {
  return (
    <div className="metric">
      <span className="stat-icon">
        <Icon name={icon} />
      </span>
      <div>
        <strong>{value}</strong>
        <small>{label}</small>
      </div>
    </div>
  );
}
function Indicators({ data }: { data: Row }) {
  const s = learning(data),
    q = data.quizzes as Row[];
  return (
    <div className="metric-grid">
      <Metric icon="book" value={s.done.size + "/" + s.lessons.length} label="Aulas concluídas" />
      <Metric
        icon="terminal"
        value={data.exercises.filter((e: Row) => e.completed).length}
        label="Exercícios realizados"
      />
      <Metric
        icon="quiz"
        value={
          q.length
            ? Math.round(q.reduce((sum, x) => sum + percentage(x.score, x.total), 0) / q.length) +
              "%"
            : "—"
        }
        label="Média nos quizzes"
      />
    </div>
  );
}
function ModuleRow({ m, done }: { m: Module; done: Set<string> }) {
  const n = m.lessons.filter((x) => done.has(x.id)).length,
    p = percentage(n, m.lessons.length);
  return (
    <a href={"/curso/modulo/" + m.id} className="module-row">
      <ModeIcon m={m} />
      <div>
        <NumberTag n={m.position} />
        <strong>{m.title}</strong>
        <small>
          {n} de {m.lessons.length} aulas concluídas
        </small>
      </div>
      <div className="rowprogress">
        <b>{p}%</b>
        <Bar value={p} />
      </div>
      <Icon name="next" size={17} />
    </a>
  );
}
function recent(data: Row) {
  return [
    ...data.progress.map((l: Row) => ({
      text: (l.completed ? "Aula concluída · " : "Aula acessada · ") + l.title,
      time: l.completed || l.accessed,
      icon: "book",
    })),
    ...data.exercises.map((x: Row) => ({
      text: (x.completed ? "Exercício concluído · " : "Exercício acessado · ") + x.title,
      time: x.completed || x.accessed,
      icon: "terminal",
    })),
    ...data.quizzes.map((q: Row) => ({
      text: "Quiz · " + q.title + " · " + percentage(q.score, q.total) + "%",
      time: q.finished,
      icon: "quiz",
    })),
  ].sort((a, b) => b.time.localeCompare(a.time));
}
export function Dashboard({ data, profile }: { data: Row; profile: Row }) {
  const s = learning(data),
    p = percentage(s.done.size, s.lessons.length),
    recentRows = recent(data).slice(0, 4),
    upcoming = s.lessons.filter((x) => !s.done.has(x.id) && x.id !== s.next?.id).slice(0, 2);
  return (
    <>
      <PageTitle
        over="Painel do aluno"
        title={"Olá, " + profile.name.split(" ")[0] + "!"}
        desc="Acompanhe sua trilha e continue de onde parou."
      />
      <div className="continue-card">
        <div>
          <span className="eyebrow">
            <i />
            Seu percurso em Python
          </span>
          <h2>{s.next?.title || "Trilha de aprendizagem"}</h2>
          {s.mod && (
            <p>
              Módulo {s.mod.position} · {s.mod.title}
            </p>
          )}
          <a className="btn light" href={s.next ? "/aula/" + s.next.id : "/curso"}>
            <Icon name="play" size={16} />
            Continuar estudando
          </a>
        </div>
        <div className="continue-progress">
          <b>{p}%</b>
          <span>Progresso geral</span>
          <Bar value={p} />
        </div>
      </div>
      <Indicators data={data} />
      <div className="two-panels">
        <section className="panel">
          <h2>Próximas aulas</h2>
          {upcoming.length ? (
            upcoming.map((l) => (
              <a className="simple-row" key={l.id} href={"/aula/" + l.id}>
                <Icon name="book" size={17} />
                <span>{l.title}</span>
                <small>{l.minutes} min</small>
                <Icon name="next" size={15} />
              </a>
            ))
          ) : (
            <Empty text="Você chegou ao fim da trilha disponível." />
          )}
          <a className="text-link" href="/curso">
            Ver toda a trilha <Icon name="arrow" size={15} />
          </a>
        </section>
        <section className="panel">
          <h2>Atividade recente</h2>
          {recentRows.length ? (
            recentRows.map((x, i) => (
              <div className="activity" key={i}>
                <Icon name={x.icon} size={16} />
                <div>
                  {x.text}
                  <small>{dateBR(x.time, true)}</small>
                </div>
              </div>
            ))
          ) : (
            <Empty text="Ao abrir sua primeira aula, ela aparecerá aqui." />
          )}
        </section>
      </div>
    </>
  );
}
export function Course({ data, id }: { data: Row; id?: string }) {
  const s = learning(data);
  if (!id)
    return (
      <>
        <PageTitle
          over="Curso de Python"
          title="Trilha de aprendizagem"
          desc="Estude os módulos na sequência ou retome uma aula anterior."
        />
        <div className="panel row-list">
          {s.modules.map((m) => (
            <ModuleRow key={m.id} m={m} done={s.done} />
          ))}
        </div>
      </>
    );
  const m = s.modules.find((x) => x.id === id);
  if (!m) return <Empty text="Este módulo não está disponível." />;
  return (
    <>
      <a className="back" href="/curso">
        <Icon name="left" size={16} />
        Trilha de aprendizagem
      </a>
      <div className="panel module-banner">
        <ModeIcon m={m} />
        <PageTitle
          over={"Módulo " + String(m.position).padStart(2, "0")}
          title={m.title}
          desc={m.description}
        />
        <Bar
          value={percentage(m.lessons.filter((l) => s.done.has(l.id)).length, m.lessons.length)}
        />
      </div>
      <h2 className="sub-heading">Aulas do módulo</h2>
      <div className="panel row-list">
        {m.lessons.map((l, i) => (
          <a className="lesson-row" href={"/aula/" + l.id} key={l.id}>
            <span className={"count" + (s.done.has(l.id) ? " complete" : "")}>
              {s.done.has(l.id) ? <Icon name="check" size={16} /> : String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <strong>{l.title}</strong>
              <p>{l.description}</p>
            </div>
            <small>{l.minutes} min</small>
            <Icon name="next" size={16} />
          </a>
        ))}
      </div>
    </>
  );
}
export function Lesson({ id, data }: { id: string; data: Row }) {
  const r = useRemote("lesson/" + id),
    l = r.value,
    [error, err] = useState(""),
    [busy, wait] = useState(false);
  const all = (data.modules as Module[]).flatMap((x) => x.lessons),
    idx = all.findIndex((x) => x.id === id),
    mod = (data.modules as Module[]).find((m) => m.id === l?.module_id);
  useEffect(() => {
    if (!l) return;
    let t = Date.now();
    const timer = setInterval(() => {
      const elapsed = Math.min(60, Math.round((Date.now() - t) / 1000));
      t = Date.now();
      if (document.visibilityState === "visible" && elapsed)
        api("lesson/" + id + "/time", { seconds: elapsed }).catch(() => {});
    }, 30000);
    return () => clearInterval(timer);
  }, [id, !!l]);
  if (!l) return r.error ? <Notice text={r.error} /> : <Loading />;
  async function mark() {
    wait(true);
    try {
      await api("lesson/" + id + "/complete", {});
      r.set({ ...l, completed: new Date().toISOString() });
    } catch (e: any) {
      err(e.message);
    } finally {
      wait(false);
    }
  }
  return (
    <>
      <a className="back" href={"/curso/modulo/" + l.module_id}>
        <Icon name="left" size={16} />
        {mod?.title}
      </a>
      <article className="panel article">
        <PageTitle
          over={"Módulo " + (mod?.position || "") + " · Aula " + l.position}
          title={l.title}
          desc={l.description}
        />
        <div className="mini-meta">
          <span>
            <Icon name="clock" size={16} />
            {l.minutes} min
          </span>
          <span>
            <Icon name="code" size={16} />
            Python
          </span>
        </div>
        <div className="callout">
          <Icon name="target" />
          <div>
            <strong>Objetivo da aula</strong>
            <p>{l.objective}</p>
          </div>
        </div>
        <h2>Entenda o conceito</h2>
        {l.theory.split(/\n\s*\n/).map((p: string, i: number) => (
          <p key={i}>{p}</p>
        ))}
        {l.code && (
          <>
            <h2>Exemplo em Python</h2>
            <PythonCode code={l.code} />
            <p>{l.explanation}</p>
          </>
        )}
        {l.note && (
          <div className="tip">
            <Icon name="bulb" />
            <p>{l.note}</p>
          </div>
        )}
        <h2>Pratique nesta aula</h2>
        {l.exercises.map((e: Row) => (
          <a className="simple-row bordered" key={e.id} href={"/exercicio/" + e.id}>
            <Icon name="terminal" />
            <span>{e.title}</span>
            <Icon name="next" size={16} />
          </a>
        ))}
        {l.questions > 0 && (
          <a className="simple-row bordered" href={"/quiz/" + l.id}>
            <Icon name="quiz" />
            <span>Quiz da aula</span>
            <small>{l.questions} questões</small>
            <Icon name="next" size={16} />
          </a>
        )}
        {l.material && (
          <a className="text-link article-link" href={l.material} target="_blank" rel="noreferrer">
            <Icon name="external" size={16} />
            Material complementar
          </a>
        )}
        <Notice text={error} />
        <div className="lesson-actions">
          <button
            className={"btn " + (l.completed ? "ghost" : "primary")}
            disabled={busy || !!l.completed}
            onClick={mark}
          >
            <Icon name={l.completed ? "checks" : "check"} size={17} />
            {l.completed ? "Aula concluída" : "Marcar como concluída"}
          </button>
          <a className="text-link" href={"/feedback?aula=" + id}>
            Avaliar aula
          </a>
        </div>
      </article>
      <div className="prev-next">
        {idx > 0 ? (
          <a className="btn ghost" href={"/aula/" + all[idx - 1].id}>
            <Icon name="left" size={16} />
            Anterior
          </a>
        ) : (
          <span />
        )}
        {idx >= 0 && idx < all.length - 1 ? (
          <a className="btn ghost" href={"/aula/" + all[idx + 1].id}>
            Próxima aula <Icon name="arrow" size={16} />
          </a>
        ) : (
          <a href="/progresso" className="btn ghost">
            Ver meu progresso
          </a>
        )}
      </div>
    </>
  );
}
export function ExercisePage({ id }: { id: string }) {
  const r = useRemote("exercise/" + id),
    v = r.value,
    [hint, setHint] = useState(false),
    [solution, show] = useState(false),
    [err, setErr] = useState(""),
    [busy, wait] = useState(false);
  if (!v) return r.error ? <Notice text={r.error} /> : <Loading />;
  async function act(action: string) {
    wait(true);
    try {
      r.set(await api("exercise/" + id + "/" + action, {}));
      setErr("");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      wait(false);
    }
  }
  return (
    <>
      <a className="back" href={"/aula/" + v.lesson_id}>
        <Icon name="left" size={16} />
        Voltar à aula
      </a>
      <article className="panel article">
        <PageTitle over={"Exercício prático · " + v.level} title={v.title} desc={v.objective} />
        <p className="prewrap">{v.prompt}</p>
        <div className="two-panels io">
          <div>
            <span className="eyebrow">Entrada de exemplo</span>
            <pre>{v.input}</pre>
          </div>
          <div>
            <span className="eyebrow">Saída esperada</span>
            <pre>{v.output}</pre>
          </div>
        </div>
        <button className="text-link" onClick={() => setHint(!hint)}>
          <Icon name="bulb" size={17} />
          {hint ? "Ocultar dica" : "Mostrar dica"}
        </button>
        {hint && <p className="tip">{v.hint}</p>}
        <h2>Praticar no Google Colab</h2>
        {!v.url && (
          <p>
            Baixe o caderno deste exercício. No Colab, selecione{" "}
            <strong>Arquivo → Fazer upload de notebook</strong> e abra o arquivo baixado.
          </p>
        )}
        <div className="inline-actions">
          <a className="btn ghost" href={"/api/notebook/" + id} onClick={() => void act("open")}>
            <Icon name="download" size={16} />
            Baixar exercício (.ipynb)
          </a>
          <a
            className="btn primary"
            href={v.url || "https://colab.research.google.com/"}
            target="_blank"
            rel="noreferrer"
            onClick={() => void act("open")}
          >
            Abrir exercício no Google Colab <Icon name="external" size={16} />
          </a>
        </div>
        <hr />
        <p>
          Depois de executar e conferir sua saída, registre a conclusão para liberar a solução
          comentada.
        </p>
        <button
          className="btn ghost"
          disabled={busy || !!v.completed}
          onClick={() => act("complete")}
        >
          <Icon name="check" size={16} />
          {v.completed ? "Exercício concluído" : "Concluir exercício"}
        </button>
        {v.completed && (
          <>
            <button className="form-link" onClick={() => show(!solution)}>
              {solution ? "Ocultar solução" : "Ver solução explicada"}
            </button>
            {solution && (
              <>
                <PythonCode code={v.solution} name="solucao.py" />
                <p>{v.explanation}</p>
              </>
            )}
          </>
        )}
        <Notice text={err} />
      </article>
    </>
  );
}
export function QuizPage({ id }: { id: string }) {
  const [q, setQ] = useState<Row | null>(null),
    [selected, select] = useState(""),
    [review, show] = useState<Row | null>(null),
    [error, err] = useState(""),
    [busy, wait] = useState(false);
  async function start(retake = false) {
    wait(true);
    err("");
    try {
      const v = await api("quiz/" + id + "/start", { retake });
      setQ(v);
      select("");
      show(null);
    } catch (e: any) {
      err(e.message);
    } finally {
      wait(false);
    }
  }
  useEffect(() => {
    void start();
  }, [id]);
  async function answer() {
    if (!selected || !q?.next) return;
    wait(true);
    try {
      const v = await api("quiz/" + q.id + "/answer", { question: q.next.id, option: selected });
      setQ(v);
      show(v.answers.at(-1));
      select("");
    } catch (e: any) {
      err(e.message);
    } finally {
      wait(false);
    }
  }
  return (
    <>
      <a className="back" href={"/aula/" + id}>
        <Icon name="left" size={16} />
        Voltar à aula
      </a>
      <div className="panel quiz-card">
        <PageTitle over={q ? "Tentativa " + q.number : "Avaliação"} title="Quiz da aula" />
        <Notice text={error} />
        {!q ? (
          !error && <Loading />
        ) : review ? (
          <>
            <div className={review.correct ? "answer-result good" : "answer-result bad"}>
              <Icon name={review.correct ? "done" : "bulb"} />
              <div>
                <h2>{review.correct ? "Resposta correta!" : "Vamos revisar?"}</h2>
                <p>{review.prompt}</p>
                <strong>Resposta correta · {review.correctLabel}</strong>
                <p>{review.explanation}</p>
              </div>
            </div>
            <button className="btn primary" onClick={() => show(null)}>
              {q.finished ? "Ver resultado" : "Próxima questão"}
              <Icon name="arrow" size={16} />
            </button>
          </>
        ) : q.finished ? (
          <>
            <div className="quiz-score">
              <Icon name="award" size={40} />
              <strong>{percentage(q.score, q.total)}%</strong>
              <span>de aproveitamento</span>
            </div>
            <div className="score-grid">
              {[
                ["Questões", q.total],
                ["Acertos", q.score],
                ["Erros", q.total - q.score],
              ].map(([l, n]) => (
                <div key={l}>
                  <b>{n}</b>
                  <small>{l}</small>
                </div>
              ))}
            </div>
            <p className="muted">
              Concluído em {dateBR(q.finished, true)} · Tentativa {q.number}
            </p>
            <div className="inline-actions">
              <a className="btn primary" href={"/aula/" + id}>
                Voltar à aula
              </a>
              <button className="btn ghost" onClick={() => start(true)} disabled={busy}>
                Tentar novamente
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="quiz-progress">
              <span>
                Questão {q.answers.length + 1} de {q.total}
              </span>
              <Bar value={percentage(q.answers.length, q.total)} />
            </div>
            <h2>{q.next.prompt}</h2>
            <fieldset className="quiz-options">
              <legend className="sr-only">Selecione uma alternativa</legend>
              {q.next.options.map((o: Row, i: number) => (
                <label key={o.id} className={selected === o.id ? "chosen" : ""}>
                  <input
                    type="radio"
                    name="answer"
                    value={o.id}
                    checked={selected === o.id}
                    onChange={() => select(o.id)}
                  />
                  <b>{String.fromCharCode(65 + i)}</b>
                  <span>{o.label}</span>
                </label>
              ))}
            </fieldset>
            <button className="btn primary" disabled={!selected || busy} onClick={answer}>
              Conferir resposta <Icon name="check" size={16} />
            </button>
          </>
        )}
      </div>
    </>
  );
}
export function Progress({ data }: { data: Row }) {
  const s = learning(data);
  return (
    <>
      <PageTitle
        over="Desempenho"
        title="Meu progresso"
        desc="Confira suas conquistas, resultados e evolução em cada módulo."
      />
      <Indicators data={data} />
      <section className="panel">
        <h2>Progresso por módulo</h2>
        {s.modules.map((m) => (
          <ModuleRow key={m.id} m={m} done={s.done} />
        ))}
      </section>
      <section className="panel">
        <h2>Conquistas</h2>
        <div className="badges">
          {data.achievements.map((a: Row) => (
            <div className={a.created ? "earned" : ""} key={a.id}>
              <Icon name={a.created ? "award" : "lock"} size={23} />
              <strong>{a.title}</strong>
              <small>{a.description}</small>
              {a.created && <small>{dateBR(a.created)}</small>}
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <h2>Histórico de quizzes</h2>
        {data.quizzes.length ? (
          data.quizzes.map((q: Row) => (
            <div className="simple-row" key={q.id}>
              <Icon name="quiz" />
              <span>
                {q.title}
                <small>
                  Tentativa {q.number} · {dateBR(q.finished, true)}
                </small>
              </span>
              <strong>
                {q.score}/{q.total} · {percentage(q.score, q.total)}%
              </strong>
            </div>
          ))
        ) : (
          <Empty text="Seus resultados aparecerão quando concluir um quiz." />
        )}
        <p className="muted">
          Tempo aproximado em aulas ·{" "}
          {Math.round(data.progress.reduce((n: number, p: Row) => n + p.seconds, 0) / 60)} min
        </p>
      </section>
    </>
  );
}
export function Feedback({ data }: { data: Row }) {
  const [scope, setScope] = useState("curso"),
    [ratings, rate] = useState<number[]>([0, 0, 0, 0, 0]),
    [improve, im] = useState(""),
    [difficulty, df] = useState(""),
    [error, err] = useState(""),
    [message, msg] = useState(""),
    [busy, wait] = useState(false);
  const lessons = (data.modules as Module[]).flatMap((m) => m.lessons);
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("aula");
    if (id && lessons.some((x) => x.id === id)) setScope(id);
  }, []);
  useEffect(() => {
    const f = data.feedback.find((x: Row) => x.scope === scope);
    rate(f ? JSON.parse(f.ratings) : [0, 0, 0, 0, 0]);
    im(f?.improve || "");
    df(f?.difficulty || "");
    msg("");
    err("");
  }, [scope]);
  return (
    <>
      <PageTitle
        over="Sua opinião"
        title="Avaliar a experiência"
        desc="Seu feedback ajuda a melhorar as aulas e a plataforma."
      />
      <form
        className="panel"
        onSubmit={async (e) => {
          e.preventDefault();
          if (ratings.some((x) => !x)) {
            err("Avalie os cinco critérios antes de enviar.");
            return;
          }
          wait(true);
          err("");
          try {
            const v = await api("feedback", { scope, ratings, improve, difficulty });
            data.feedback = [
              ...data.feedback.filter((x: Row) => x.scope !== scope),
              { scope, ratings: JSON.stringify(ratings), improve, difficulty },
            ];
            msg(v.message);
          } catch (e: any) {
            err(e.message);
          } finally {
            wait(false);
          }
        }}
      >
        <Field label="O que deseja avaliar?">
          <select value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="curso">Curso completo</option>
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
        </Field>
        <p className="muted">Escolha de 1 (muito ruim) a 5 (excelente).</p>
        {dimensions.map((l, i) => (
          <fieldset className="rating-row" key={l}>
            <legend>{l}</legend>
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className={ratings[i] === n ? "active" : ""}>
                <input
                  type="radio"
                  name={"rating" + i}
                  aria-label={l + ", nota " + n}
                  checked={ratings[i] === n}
                  onChange={() => rate(ratings.map((v, j) => (j === i ? n : v)))}
                />
                {n}
              </label>
            ))}
          </fieldset>
        ))}
        <Field label="O que poderíamos melhorar?">
          <textarea maxLength={2000} value={improve} onChange={(e) => im(e.target.value)} />
        </Field>
        <Field label="Qual foi sua principal dificuldade?">
          <textarea maxLength={2000} value={difficulty} onChange={(e) => df(e.target.value)} />
        </Field>
        <Notice text={error} />
        <Notice text={message} success />
        <button className="btn primary" disabled={busy}>
          Enviar avaliação <Icon name="arrow" size={16} />
        </button>
      </form>
    </>
  );
}
export function Profile({ session }: { session: Row }) {
  const [p, set] = useState<Row>({ ...session.profile }),
    [error, err] = useState(""),
    [message, msg] = useState(""),
    [del, setDel] = useState(false),
    [confirmation, confirm] = useState(""),
    [busy, wait] = useState(false);
  async function photo(file?: File) {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 4000000) {
      err("Selecione uma imagem PNG, JPEG ou WebP de até 4 MB.");
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 160;
      const sz = Math.min(img.width, img.height);
      canvas
        .getContext("2d")
        ?.drawImage(img, (img.width - sz) / 2, (img.height - sz) / 2, sz, sz, 0, 0, 160, 160);
      set({ ...p, photo: canvas.toDataURL("image/jpeg", 0.82) });
    } catch {
      err("Esta imagem não pôde ser lida.");
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  return (
    <>
      <PageTitle over="Conta" title="Meu perfil" desc="Atualize os dados da sua matrícula." />
      <form
        className="panel"
        onSubmit={async (e) => {
          e.preventDefault();
          wait(true);
          err("");
          try {
            const v = await api("profile/update", p);
            msg(v.message);
          } catch (e: any) {
            err(e.message);
          } finally {
            wait(false);
          }
        }}
      >
        <div className="photo-area">
          {p.photo ? (
            <img className="avatarpic" src={p.photo} alt="Sua foto de perfil" />
          ) : (
            <span className="avatar">{p.name[0]}</span>
          )}
          <Field label="Foto de perfil (opcional)">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => photo(e.target.files?.[0])}
            />
          </Field>
          {p.photo && (
            <button type="button" className="text-link" onClick={() => set({ ...p, photo: "" })}>
              Remover
            </button>
          )}
        </div>
        <ProfileFields data={p} set={set} education={session.education} />
        <Notice text={error} />
        <Notice text={message} success />
        <button className="btn primary" disabled={busy}>
          Salvar alterações
        </button>
      </form>
      <section className="panel">
        <h2>Acesso e privacidade</h2>
        <div className="inline-actions">
          <a className="btn ghost" href="/nova-senha">
            Gerenciar senha
          </a>
          <button className="btn danger" onClick={() => setDel(!del)}>
            Excluir minha conta
          </button>
        </div>
        {del && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const r = await api("profile/delete", { confirm: confirmation });
                location.assign(r.next);
              } catch (x: any) {
                err(x.message);
              }
            }}
          >
            <p>
              Esta ação exclui permanentemente seu perfil, histórico, respostas e avaliações. Digite
              EXCLUIR para confirmar.
            </p>
            <Field label="Confirmação de exclusão">
              <input required value={confirmation} onChange={(e) => confirm(e.target.value)} />
            </Field>
            <button className="btn danger" disabled={confirmation !== "EXCLUIR"}>
              Excluir meus dados
            </button>
          </form>
        )}
      </section>
    </>
  );
}
