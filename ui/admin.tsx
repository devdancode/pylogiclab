"use client";
import React, { useEffect, useState } from "react";
import { api, Empty, Field, Icon, Loading, ModeIcon, Notice, PageTitle, useRemote } from "./common";
import { categories, dateBR, percentage, type Module, type Row } from "../lib/model";
import { Progress } from "./study";
const metricLabels: Record<string, string> = {
  users: "Participantes cadastrados",
  active: "Ativos nos últimos 30 dias",
  modules: "Módulos publicados",
  lessons: "Aulas publicadas",
  exercises: "Exercícios disponíveis",
  completion: "Conclusão média (%)",
  quiz: "Aproveitamento nos quizzes (%)",
  rating: "Avaliação média (1 a 5)",
  accessed: "Aulas acessadas",
  done: "Aulas concluídas",
  practiceOpened: "Exercícios acessados",
  practice: "Exercícios concluídos",
  attempts: "Quizzes finalizados",
  feedback: "Avaliações recebidas",
};
function Chart({ title, items, max }: { title: string; items: Row[]; max?: number }) {
  const scale = max || Math.max(...items.map((i) => i.value), 1);
  return (
    <section className="panel chart-panel">
      <h3>{title}</h3>
      {items.length ? (
        items.map((x, i) => (
          <div className="chart-line" key={i}>
            <div>
              <span>{x.label}</span>
              <b>{String(x.value).replace(".", ",")}</b>
            </div>
            <i>
              <em style={{ width: Math.min(100, (x.value / scale) * 100) + "%" }} />
            </i>
          </div>
        ))
      ) : (
        <Empty text="Ainda não há dados para este indicador." />
      )}
    </section>
  );
}
function downloadReports(r: Row) {
  const cells: unknown[][] = [["Indicador", "Categoria", "Valor"]];
  Object.entries(r.metrics).forEach(([k, v]) => cells.push(["Resumo", metricLabels[k], v]));
  for (const [k, label] of [
    ["periods", "Cadastros por mês"],
    ["cities", "Cidade"],
    ["experience", "Experiência"],
    ["ages", "Faixa etária"],
    ["usability", "Avaliação média"],
    ["lessonRatings", "Avaliação por aula"],
    ["errors", "Erro por questão (%)"],
  ])
    for (const v of r[k]) cells.push([label, v.label, v.value]);
  for (const m of r.modules)
    for (const [k, l] of [
      ["started", "Módulo iniciado"],
      ["completed", "Módulo concluído"],
      ["inactive", "Inatividade há 14 dias"],
      ["value", "Conclusão do módulo (%)"],
    ])
      cells.push([l, m.label, m[k]]);
  const esc = (v: unknown) => {
    let str = String(v ?? "");
    if (/^[=+@\-\t\r]/.test(str)) str = "'" + str;
    return '"' + str.replaceAll('"', '""') + '"';
  };
  const url = URL.createObjectURL(
    new Blob(["\uFEFF" + cells.map((row) => row.map(esc).join(";")).join("\r\n")], {
      type: "text/csv;charset=utf-8",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "logicalab-relatorio-agregado.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
export function Reports({ home = false }: { home?: boolean }) {
  const r = useRemote("admin/reports"),
    people = useRemote(home ? "admin/users" : null),
    notes = useRemote(home ? null : "admin/feedback");
  if (!r.value) return r.error ? <Notice text={r.error} /> : <Loading />;
  const v = r.value;
  return (
    <>
      <PageTitle
        over="Administração"
        title={home ? "Visão geral" : "Relatórios acadêmicos"}
        desc={
          home
            ? "Acompanhe a participação e a atividade na plataforma."
            : "Indicadores agregados de utilização e desempenho da atividade extensionista."
        }
      />
      {!home && (
        <button className="btn primary report-download" onClick={() => downloadReports(v)}>
          <Icon name="download" size={17} />
          Exportar CSV agregado
        </button>
      )}
      <div className="admin-metrics">
        {Object.entries(v.metrics)
          .slice(0, home ? 8 : undefined)
          .map(([key, value]) => (
            <div className="metric" key={key}>
              <div>
                <strong>{value === null ? "—" : String(value).replace(".", ",")}</strong>
                <small>{metricLabels[key]}</small>
              </div>
            </div>
          ))}
      </div>
      {home ? (
        <>
          <div className="panel">
            <h2>Últimos cadastros</h2>
            {people.value?.length ? (
              people.value.slice(0, 5).map((p: Row) => (
                <a
                  className="simple-row"
                  href={"/admin/usuarios/" + encodeURIComponent(p.id)}
                  key={p.id}
                >
                  <Icon name="user" />
                  <span>
                    {p.name}
                    <small>
                      {p.city} · {p.state}
                    </small>
                  </span>
                  <small>{dateBR(p.created)}</small>
                  <Icon name="next" size={15} />
                </a>
              ))
            ) : (
              <Empty text="Nenhum cadastro registrado." />
            )}
          </div>
          <a className="btn ghost" href="/admin/relatorios">
            Consultar relatórios <Icon name="arrow" size={16} />
          </a>
        </>
      ) : (
        <>
          <div className="two-panels charts">
            {[
              ["Cadastros por mês", "periods"],
              ["Participantes por cidade", "cities"],
              ["Experiência anterior", "experience"],
              ["Faixa etária", "ages"],
              ["Usabilidade e conteúdo (1–5)", "usability"],
              ["Avaliação por aula (1–5)", "lessonRatings"],
              ["Questões com mais erros (%)", "errors"],
            ].map(([title, key]) => (
              <Chart
                key={key}
                title={title}
                items={v[key]}
                max={
                  key === "usability" || key === "lessonRatings"
                    ? 5
                    : key === "errors"
                    ? 100
                    : undefined
                }
              />
            ))}
          </div>
          <div className="panel tablewrap">
            <h2>Participação por módulo</h2>
            <p className="muted">
              Inatividade corresponde a um módulo iniciado, ainda incompleto, sem acesso há 14 dias.
            </p>
            <table>
              <thead>
                <tr>
                  {["Módulo", "Iniciaram", "Concluíram", "Conclusão", "Inativos"].map((x) => (
                    <th key={x}>{x}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {v.modules.map((m: Row) => (
                  <tr key={m.label}>
                    <td>{m.label}</td>
                    <td>{m.started}</td>
                    <td>{m.completed}</td>
                    <td>{m.value}%</td>
                    <td>{m.inactive}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="panel">
            <h2>Comentários de feedback</h2>
            <p className="muted">
              Visíveis apenas nesta área administrativa. O arquivo acadêmico exporta os indicadores
              agregados.
            </p>
            {notes.value?.length ? (
              notes.value.map((f: Row, i: number) => (
                <div className="feedback-entry" key={i}>
                  <b>
                    {f.title || "Curso completo"} · {dateBR(f.created)}
                  </b>
                  <p>Melhoria sugerida · {f.improve || "Sem comentário"}</p>
                  <p>Dificuldade · {f.difficulty || "Sem comentário"}</p>
                </div>
              ))
            ) : (
              <Empty text="Nenhum feedback recebido." />
            )}
          </div>
        </>
      )}
    </>
  );
}
export function AdminUsers({ id, count }: { id?: string; count: number }) {
  const r = useRemote("admin/users" + (id ? "/" + encodeURIComponent(id) : "")),
    [query, search] = useState(""),
    [role, setRole] = useState("aluno"),
    [active, activate] = useState(1),
    [msg, note] = useState(""),
    [error, err] = useState("");
  useEffect(() => {
    if (r.value?.person) {
      setRole(r.value.person.role);
      activate(r.value.person.active);
    }
  }, [r.value]);
  if (!r.value) return r.error ? <Notice text={r.error} /> : <Loading />;
  if (id) {
    const p = r.value.person;
    return (
      <>
        <a className="back" href="/admin/usuarios">
          <Icon name="left" size={16} />
          Todos os usuários
        </a>
        <PageTitle over="Dados do participante" title={p.name} desc={p.email} />
        <div className="panel">
          <div className="facts">
            {[
              ["Telefone", p.phone],
              ["Localidade", p.city + " / " + p.state],
              ["Nascimento", p.birth.split("-").reverse().join("/")],
              ["Escolaridade", p.education],
              ["Experiência", p.experience],
              ["Objetivo", p.goal || "—"],
              ["Cadastro", dateBR(p.created)],
              ["Último acesso", dateBR(p.last_seen, true)],
            ].map(([l, v]) => (
              <div key={l}>
                <small>{l}</small>
                <strong>{v}</strong>
              </div>
            ))}
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const v = await api("admin/users/" + encodeURIComponent(id), { role, active });
                note(v.message);
                err("");
              } catch (e: any) {
                err(e.message);
              }
            }}
          >
            <div className="form-grid">
              <Field label="Função">
                <select value={role} onChange={(e) => setRole(e.target.value)}>
                  {["aluno", "admin", "instrutor"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <select value={active} onChange={(e) => activate(Number(e.target.value))}>
                  <option value="1">Ativo</option>
                  <option value="0">Desativado</option>
                </select>
              </Field>
            </div>
            <button className="btn ghost">Atualizar acesso</button>
            <Notice text={error} />
            <Notice text={msg} success />
          </form>
        </div>
        <Progress data={r.value.history} />
      </>
    );
  }
  const list = (r.value as Row[]).filter((x) =>
    (x.name + " " + x.email).toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  return (
    <>
      <PageTitle
        over="Administração"
        title="Usuários"
        desc="Consulte o cadastro, o acesso e o progresso de cada participante."
      />
      <div className="panel tablewrap">
        <label className="search">
          <Icon name="search" size={16} />
          <input
            aria-label="Buscar usuários"
            placeholder="Buscar por nome ou e-mail"
            value={query}
            onChange={(e) => search(e.target.value)}
          />
        </label>
        <table>
          <thead>
            <tr>
              {[
                "Nome e e-mail",
                "Telefone",
                "Cidade",
                "Cadastro",
                "Último acesso",
                "Progresso",
                "Status",
              ].map((x) => (
                <th key={x}>{x}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                <td>
                  <a href={"/admin/usuarios/" + encodeURIComponent(p.id)}>{p.name}</a>
                  <small>{p.email}</small>
                </td>
                <td>{p.phone}</td>
                <td>
                  {p.city}/{p.state}
                </td>
                <td>{dateBR(p.created)}</td>
                <td>{dateBR(p.last_seen)}</td>
                <td>{percentage(p.done, count)}%</td>
                <td>{p.active ? "Ativo" : "Desativado"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!list.length && <Empty text="Nenhum usuário encontrado." />}
      </div>
    </>
  );
}
const defaultModule = {
  title: "",
  description: "",
  position: 1,
  icon: "brain",
  level: "Iniciante",
  category: "Fundamentos",
  published: 1,
};
const defaultLesson = {
  module_id: "",
  title: "",
  description: "",
  objective: "",
  theory: "",
  code: "",
  explanation: "",
  note: "",
  material: "",
  minutes: 10,
  position: 1,
  published: 1,
  exercises: [],
  quiz: [],
};
const defaultExercise = {
  title: "",
  prompt: "",
  objective: "",
  level: "Iniciante",
  input: "",
  output: "",
  hint: "",
  solution: "",
  explanation: "",
  url: "",
};
const defaultQuestion = { prompt: "", options: ["", "", ""], answer: 0, explanation: "" };
const labels: Record<string, string> = {
  title: "Título",
  description: "Descrição",
  position: "Ordem",
  level: "Nível de dificuldade",
  objective: "Objetivo",
  theory: "Conteúdo teórico",
  code: "Exemplo de código Python",
  explanation: "Explicação",
  note: "Observação importante",
  material: "Link de material complementar",
  minutes: "Duração em minutos",
  prompt: "Enunciado",
  input: "Entrada de exemplo",
  output: "Saída esperada",
  hint: "Dica",
  solution: "Solução em Python",
  url: "Link de caderno no Colab (opcional)",
};
function control(k: string, d: Row, set: (d: Row) => void, multi = false) {
  const num = ["minutes", "position"].includes(k),
    required = ["title", "theory", "prompt", "minutes", "position"].includes(k);
  return (
    <Field key={k} label={labels[k] || k}>
      {multi ? (
        <textarea
          value={d[k] ?? ""}
          rows={k === "theory" || k === "solution" ? 5 : 3}
          required={required}
          onChange={(e) => set({ ...d, [k]: e.target.value })}
        />
      ) : (
        <input
          type={num ? "number" : k === "material" || k === "url" ? "url" : "text"}
          min={num ? 1 : undefined}
          value={d[k] ?? ""}
          required={required}
          onChange={(e) => set({ ...d, [k]: num ? Number(e.target.value) : e.target.value })}
        />
      )}
    </Field>
  );
}
function Editor({
  kind,
  initial,
  modules,
  exit,
}: {
  kind: "module" | "lesson";
  initial: Row;
  modules: Module[];
  exit: () => void;
}) {
  const [d, set] = useState<Row>(initial),
    [error, err] = useState(""),
    [busy, wait] = useState(false);
  const isLesson = kind === "lesson";
  const replace = (key: string, i: number, data: Row) =>
    set({ ...d, [key]: d[key].map((v: Row, j: number) => (j === i ? data : v)) });
  const remove = (key: string, i: number) =>
    set({ ...d, [key]: d[key].filter((_: Row, j: number) => j !== i) });
  return (
    <div className="panel">
      <button className="back" onClick={exit}>
        <Icon name="left" size={16} />
        Voltar aos conteúdos
      </button>
      <h2>
        {d.id ? "Editar" : "Criar"} {isLesson ? "aula" : "módulo"}
      </h2>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          wait(true);
          err("");
          try {
            await api("admin/" + kind + (d.id ? "/" + d.id : ""), d);
            exit();
          } catch (e: any) {
            err(e.message);
            wait(false);
          }
        }}
      >
        {control("title", d, set)}
        {control("description", d, set, true)}
        <div className="form-grid">
          {control("position", d, set)}
          <Field label="Visibilidade">
            <select
              value={d.published}
              onChange={(e) => set({ ...d, published: Number(e.target.value) })}
            >
              <option value="1">Publicado</option>
              <option value="0">Oculto</option>
            </select>
          </Field>
        </div>
        {isLesson ? (
          <>
            <Field label="Módulo">
              <select
                required
                value={d.module_id}
                onChange={(e) => set({ ...d, module_id: e.target.value })}
              >
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </Field>
            {control("minutes", d, set)}
            {["objective", "theory", "code", "explanation", "note"].map((k) =>
              control(k, d, set, true),
            )}
            {control("material", d, set)}
            <h3>Exercícios práticos</h3>
            {d.exercises.map((ex: Row, i: number) => (
              <fieldset className="editor-item" key={i}>
                <legend>Exercício {i + 1}</legend>
                {Object.keys(defaultExercise).map((k) =>
                  control(
                    k,
                    ex,
                    (x) => replace("exercises", i, x),
                    !["title", "level", "url"].includes(k),
                  ),
                )}
                <button
                  className="text-danger"
                  type="button"
                  onClick={() => remove("exercises", i)}
                >
                  Remover exercício
                </button>
              </fieldset>
            ))}
            <button
              type="button"
              className="btn ghost"
              onClick={() => set({ ...d, exercises: [...d.exercises, { ...defaultExercise }] })}
            >
              <Icon name="plus" size={16} />
              Adicionar exercício
            </button>
            <h3>Questões do quiz</h3>
            {d.quiz.map((q: Row, i: number) => (
              <fieldset className="editor-item" key={i}>
                <legend>Questão {i + 1}</legend>
                {control("prompt", q, (x) => replace("quiz", i, x), true)}
                {q.options.map((o: string, j: number) => (
                  <Field key={j} label={"Alternativa " + String.fromCharCode(65 + j)}>
                    <input
                      required
                      value={o}
                      onChange={(e) =>
                        replace("quiz", i, {
                          ...q,
                          options: q.options.map((v: string, k: number) =>
                            j === k ? e.target.value : v,
                          ),
                        })
                      }
                    />
                  </Field>
                ))}
                {q.options.length < 8 && (
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => replace("quiz", i, { ...q, options: [...q.options, ""] })}
                  >
                    Adicionar alternativa
                  </button>
                )}
                <Field label="Alternativa correta">
                  <select
                    value={q.answer}
                    onChange={(e) => replace("quiz", i, { ...q, answer: Number(e.target.value) })}
                  >
                    {q.options.map((_: string, j: number) => (
                      <option key={j} value={j}>
                        {String.fromCharCode(65 + j)}
                      </option>
                    ))}
                  </select>
                </Field>
                {control("explanation", q, (x) => replace("quiz", i, x), true)}
                <button type="button" className="text-danger" onClick={() => remove("quiz", i)}>
                  Remover questão
                </button>
              </fieldset>
            ))}
            <button
              type="button"
              className="btn ghost"
              onClick={() =>
                set({ ...d, quiz: [...d.quiz, { ...defaultQuestion, options: ["", "", ""] }] })
              }
            >
              <Icon name="plus" size={16} />
              Adicionar questão
            </button>
          </>
        ) : (
          <>
            <div className="form-grid">
              <Field label="Grupo na trilha">
                <select
                  value={d.category}
                  onChange={(e) => set({ ...d, category: e.target.value })}
                >
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              {control("level", d, set)}
            </div>
            <Field label="Ícone do módulo">
              <select value={d.icon} onChange={(e) => set({ ...d, icon: e.target.value })}>
                {Object.entries({
                  brain: "Lógica",
                  route: "Fluxograma",
                  boxes: "Blocos",
                  calculator: "Cálculo",
                  terminal: "Terminal",
                  split: "Decisão",
                  repeat: "Repetição",
                  list: "Lista",
                  function: "Função",
                  rocket: "Projeto",
                }).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}
        <Notice text={error} />
        <div className="inline-actions editor-save">
          <button className="btn primary" disabled={busy}>
            <Icon name="save" size={16} />
            Salvar {isLesson ? "aula" : "módulo"}
          </button>
          <button type="button" className="btn ghost" onClick={exit}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
export function Contents({ education }: { education: string[] }) {
  const r = useRemote("admin/content"),
    [edit, setEdit] = useState<{ kind: "module" | "lesson"; data: Row } | null>(null),
    [del, setDel] = useState<Row | null>(null),
    [ed, setEd] = useState(education.join("\n")),
    [message, msg] = useState(""),
    [error, err] = useState("");
  if (!r.value) return r.error ? <Notice text={r.error} /> : <Loading />;
  const mods: Module[] = r.value;
  const editLesson = async (id: string) => {
    try {
      setEdit({ kind: "lesson", data: await api("admin/lesson/" + id) });
    } catch (e: any) {
      err(e.message);
    }
  };
  return (
    <>
      <PageTitle
        over="Administração"
        title="Conteúdos do curso"
        desc="Organize módulos, aulas, exercícios e questionários."
      />
      <Notice text={error} />
      <Notice text={message} success />
      {edit ? (
        <Editor
          key={edit.kind + "-" + (edit.data.id || "new")}
          kind={edit.kind}
          initial={edit.data}
          modules={mods}
          exit={() => {
            setEdit(null);
            r.reload();
          }}
        />
      ) : (
        <>
          <button
            className="btn primary"
            onClick={() =>
              setEdit({
                kind: "module",
                data: {
                  ...defaultModule,
                  position: Math.max(0, ...mods.map((m) => m.position)) + 1,
                },
              })
            }
          >
            <Icon name="plus" size={16} />
            Criar módulo
          </button>
          {del && (
            <div className="panel delete-confirm">
              <h3>Excluir “{del.title}”?</h3>
              <p>
                Esta ação remove o conteúdo e seus registros associados. Para preservar o histórico,
                você também pode ocultar o conteúdo no editor.
              </p>
              <button
                className="btn danger"
                onClick={async () => {
                  try {
                    await api("admin/delete", { id: del.id, kind: del.kind, confirm: del.id });
                    setDel(null);
                    r.reload();
                  } catch (e: any) {
                    err(e.message);
                  }
                }}
              >
                Confirmar exclusão
              </button>{" "}
              <button className="btn ghost" onClick={() => setDel(null)}>
                Cancelar
              </button>
            </div>
          )}
          {mods.map((m) => (
            <section className="panel" key={m.id}>
              <div className="admin-module">
                <ModeIcon m={m} />
                <div>
                  <span className="eyebrow">
                    Módulo {m.position} · {m.published ? "Publicado" : "Oculto"}
                  </span>
                  <h3>{m.title}</h3>
                </div>
                <button
                  className="icon-btn"
                  title="Editar módulo"
                  aria-label={"Editar módulo " + m.title}
                  onClick={() => setEdit({ kind: "module", data: m })}
                >
                  <Icon name="edit" size={17} />
                </button>
                <button
                  className="icon-btn"
                  title="Excluir módulo"
                  aria-label={"Excluir módulo " + m.title}
                  onClick={() => setDel({ ...m, kind: "module" })}
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>
              {m.lessons.map((l) => (
                <div className="simple-row" key={l.id}>
                  <Icon name="book" size={16} />
                  <span>
                    {l.position}. {l.title} {!l.published && "· Oculta"}
                  </span>
                  <button
                    className="icon-btn"
                    aria-label={"Editar aula " + l.title}
                    onClick={() => editLesson(l.id)}
                  >
                    <Icon name="edit" size={16} />
                  </button>
                  <button
                    className="icon-btn"
                    aria-label={"Excluir aula " + l.title}
                    onClick={() => setDel({ ...l, kind: "lesson" })}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              ))}
              <button
                className="text-link"
                onClick={() =>
                  setEdit({
                    kind: "lesson",
                    data: {
                      ...defaultLesson,
                      module_id: m.id,
                      position: Math.max(0, ...m.lessons.map((l) => l.position)) + 1,
                    },
                  })
                }
              >
                <Icon name="plus" size={16} />
                Nova aula
              </button>
            </section>
          ))}
          <form
            className="panel"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const v = await api("admin/education", {
                  names: ed
                    .split("\n")
                    .map((x) => x.trim())
                    .filter(Boolean),
                });
                msg(v.message);
              } catch (e: any) {
                err(e.message);
              }
            }}
          >
            <h2>Opções de escolaridade</h2>
            <Field label="Uma opção por linha">
              <textarea rows={6} value={ed} onChange={(e) => setEd(e.target.value)} />
            </Field>
            <button className="btn ghost">Salvar opções</button>
          </form>
        </>
      )}
    </>
  );
}
