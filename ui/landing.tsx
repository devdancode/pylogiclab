"use client";
import { useEffect, useState } from "react";
import { Header, Footer, Icon, ModeIcon, NumberTag, PythonCode } from "./common";
import type { Module } from "../lib/model";
import { categories } from "../lib/model";

export function ModuleCard({ m, href }: { m: Module; href: string }) {
  return (
    <a className={"module-card tone" + ((m.position - 1) % 5)} href={href}>
      <div className="card-art">
        <div className="art-pattern" />
        <div className="art-icon">
          <Icon name={m.icon} size={41} />
        </div>
        <div className="art-ghost">
          <Icon name={m.icon} size={116} />
        </div>
        <span className="art-category">{m.category}</span>
      </div>
      <div className="card-content">
        <NumberTag n={m.position} />
        <h3>{m.title}</h3>
        <p>{m.description}</p>
        <div className="card-end">
          <span>
            <Icon name="book" size={15} />
            {m.lessons.length} aulas
          </span>
          <span>
            <Icon name="clock" size={15} />
            {m.lessons.reduce((s, x) => s + x.minutes, 0)} min
          </span>
          <i>
            <Icon name="arrow" size={16} />
          </i>
        </div>
      </div>
    </a>
  );
}
export function Catalogue({ modules, full = false }: { modules: Module[]; full?: boolean }) {
  const [cat, setCat] = useState("Todos"),
    [query, setQuery] = useState("");
  const filtered = modules.filter(
    (m) =>
      (cat === "Todos" || m.category === cat) &&
      m.title.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")),
  );
  const displayed = full || cat !== "Todos" ? filtered : filtered.slice(0, 3);
  return (
    <section className={full ? "catalog full" : "catalog"} id="trilha">
      <div className="wrapper">
        <div className="section-intro">
          <div>
            <span className="eyebrow blue">
              <i />
              Trilha de aprendizagem
            </span>
            <h2>{full ? "Todos os módulos" : "Explore os módulos"}</h2>
            <p>Do primeiro algoritmo ao seu projeto em Python, um passo de cada vez.</p>
          </div>
          {!full && (
            <a className="text-link" href="/trilha">
              Ver trilha completa <Icon name="arrow" size={17} />
            </a>
          )}
        </div>
        <div className="filters">
          <div className="tabs" aria-label="Filtrar módulos">
            {["Todos", ...categories].map((c) => (
              <button
                key={c}
                className={cat === c ? "selected" : ""}
                aria-pressed={cat === c}
                onClick={() => setCat(c)}
              >
                {c}
              </button>
            ))}
          </div>
          {full && (
            <label className="search">
              <Icon name="search" size={16} />
              <input
                aria-label="Buscar módulo"
                placeholder="Buscar módulo"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          )}
        </div>
        <div className="module-grid">
          {displayed.map((m) => (
            <ModuleCard key={m.id} m={m} href={"/trilha/" + m.id} />
          ))}
        </div>
        {!displayed.length && <p className="empty">Nenhum módulo corresponde à busca.</p>}
      </div>
    </section>
  );
}
export function Home({
  modules,
  exerciseCount,
  member,
}: {
  modules: Module[];
  exerciseCount: number;
  member: boolean;
}) {
  useEffect(() => {
    if (new URLSearchParams(location.hash.slice(1)).has("access_token"))
      location.replace("/confirmar" + location.hash);
  }, []);
  const lessons = modules.flatMap((x) => x.lessons);
  return (
    <>
      <Header member={member} />
      <main id="principal">
        <section className="hero">
          <div className="hero-grid" />
          <div className="wrapper hero-inner">
            <div className="hero-copy">
              <span className="hero-pill">
                <i />
                Curso gratuito <b /> Nível iniciante
              </span>
              <h1>
                Aprenda a pensar
                <br />
                <em>em código.</em>
              </h1>
              <p>
                Desenvolva seu raciocínio lógico e aprenda Python do zero, com aulas guiadas e
                exercícios que transformam teoria em prática.
              </p>
              <div className="hero-actions">
                <a className="btn primary" href={member ? "/dashboard" : "/cadastro"}>
                  {member ? "Continuar estudando" : "Começar a aprender"}{" "}
                  <Icon name="arrow" size={18} />
                </a>
                <a className="btn ghost" href="#trilha">
                  <Icon name="trail" size={18} />
                  Explorar a trilha
                </a>
              </div>
            </div>
            <div className="hero-art">
              <img
                src="/media/laboratorio-python.webp"
                alt="Notebook lilás com linhas de código e os símbolos de Python e programação ao redor."
                fetchPriority="high"
                width="1152"
                height="768"
              />
            </div>
          </div>
        </section>
        <div className="stats-band">
          <div className="wrapper hero-stats">
            {[
              ["layers", String(modules.length), "Módulos"],
              ["book", String(lessons.length), "Aulas guiadas"],
              ["terminal", String(exerciseCount), "Exercícios práticos"],
              ["clock", "No seu ritmo", "Estudo flexível"],
            ].map(([icon, n, l]) => (
              <div className="stat" key={icon}>
                <span className="stat-icon">
                  <Icon name={icon} size={22} />
                </span>
                <div>
                  <strong>{n}</strong>
                  <small>{l}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
        <Catalogue modules={modules} />
        <section id="projeto" className="project">
          <div className="wrapper project-inner">
            <div>
              <span className="eyebrow blue">
                <i />
                Sobre o projeto
              </span>
              <h2>
                Da sala de aula
                <br />
                para a comunidade.
              </h2>
              <p>
                A LógicaLab nasceu de uma atividade de extensão em Engenharia da Computação para
                aproximar a comunidade de Pirassununga da programação.
              </p>
              <span className="place">
                <Icon name="pin" size={17} />
                Pirassununga, São Paulo
              </span>
            </div>
            <div className="project-practice">
              <span className="eyebrow">Seu primeiro programa</span>
              <PythonCode code={'cidade = "Pirassununga"\nprint("Olá,", cidade)'} />
              <div className="output-line">
                <Icon name="terminal" size={16} />
                Olá, Pirassununga
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
export function PublicTrail({
  modules,
  id,
  member,
}: {
  modules: Module[];
  id?: string;
  member: boolean;
}) {
  const m = modules.find((x) => x.id === id);
  return (
    <>
      <Header current="trilha" member={member} />
      <main id="principal">
        {!id ? (
          <Catalogue modules={modules} full />
        ) : m ? (
          <div className="wrapper module-preview">
            <a className="back" href="/trilha">
              <Icon name="left" size={16} />
              Todos os módulos
            </a>
            <div className="panel preview-title">
              <ModeIcon m={m} />
              <NumberTag n={m.position} />
              <h1>{m.title}</h1>
              <p>{m.description}</p>
              <div className="mini-meta">
                <span>
                  <Icon name="book" size={16} />
                  {m.lessons.length} aulas
                </span>
                <span>
                  <Icon name="clock" size={16} />
                  {m.lessons.reduce((s, x) => s + x.minutes, 0)} minutos
                </span>
              </div>
              <a className="btn primary" href={member ? "/curso/modulo/" + id : "/cadastro"}>
                {member ? "Estudar este módulo" : "Matricular-se gratuitamente"}
                <Icon name="arrow" size={16} />
              </a>
            </div>
            <h2>Aulas deste módulo</h2>
            {m.lessons.map((l, i) => (
              <div className="lesson-row" key={l.id}>
                <span className="count">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{l.title}</strong>
                  <p>{l.description}</p>
                </div>
                <small>{l.minutes} min</small>
              </div>
            ))}
          </div>
        ) : (
          <div className="wrapper module-preview">
            <h1>Módulo não encontrado</h1>
            <a className="text-link" href="/trilha">
              Voltar à trilha
            </a>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
