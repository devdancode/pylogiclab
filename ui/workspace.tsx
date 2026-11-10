"use client";
import { useEffect, useState } from "react";
import { api, Brand, Empty, Icon, Loading, Notice, PageTitle, useRemote } from "./common";
import {
  Dashboard,
  Course,
  Lesson,
  ExercisePage,
  QuizPage,
  Progress,
  Profile,
  Feedback,
} from "./study";
import { Onboard } from "./account";
import { Reports, AdminUsers, Contents } from "./admin";
import { dateBR, type Module, type Row } from "../lib/model";
const student = [
  ["dashboard", "Visão geral", "dashboard"],
  ["curso", "Minha trilha", "trail"],
  ["progresso", "Meu progresso", "chart"],
  ["feedback", "Avaliar experiência", "message"],
];
const admin = [
  ["admin", "Visão geral", "dashboard"],
  ["admin/usuarios", "Usuários", "users"],
  ["admin/conteudos", "Conteúdos", "book"],
  ["admin/relatorios", "Relatórios", "chart"],
];
export function Workspace({ path }: { path: string[] }) {
  const sess = useRemote("session"),
    data = useRemote(sess.value?.profile ? "study" : null),
    [menu, setMenu] = useState(false),
    [error, err] = useState("");
  const p = sess.value?.profile,
    part = path[0],
    id = path[1],
    isAdmin = part === "admin",
    route = path.join("/");
  useEffect(() => {
    if (sess.value && !p) {
      location.replace(
        sess.value.identity ? "/matricula" : "/login?next=" + encodeURIComponent(location.pathname),
      );
    } else if (p && part === "admin" && p.role !== "admin") {
      location.replace("/dashboard");
    } else if (p && !p.onboarded && part !== "boas-vindas") {
      location.replace("/boas-vindas");
    }
  }, [sess.value, p, part]);
  if (!p || !data.value || (isAdmin && p.role !== "admin"))
    return (
      <>
        <div className="wrapper loading-brand">
          <Brand />
        </div>
        <main id="principal" className="wrapper">
          {sess.error || data.error ? (
            <>
              <Notice text={sess.error || data.error} />
              <a href="/login" className="btn ghost">
                Voltar ao acesso
              </a>
            </>
          ) : (
            <Loading />
          )}
        </main>
      </>
    );
  const state = data.value,
    unread = state.notes.filter((x: Row) => !x.seen).length;
  const current = isAdmin
    ? id
      ? "admin/" + id
      : "admin"
    : ["aula", "exercicio", "quiz"].includes(part)
    ? "curso"
    : part;
  async function logout() {
    try {
      const result = await api("auth/logout", {});
      location.assign(result.next);
    } catch (e: any) {
      err(e.message);
    }
  }
  return (
    <div className="workspace">
      <div className="mobile-work-head">
        <Brand />
        <button
          className="icon-btn"
          aria-label="Menu da plataforma"
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
        >
          <Icon name={menu ? "x" : "menu"} />
        </button>
      </div>
      {menu && (
        <button className="sidebar-scrim" aria-label="Fechar menu" onClick={() => setMenu(false)} />
      )}
      <aside className={"sidebar" + (menu ? " opened" : "")}>
        <Brand />
        <div className="side-label">{isAdmin ? "Administração" : "Área do aluno"}</div>
        <nav>
          {(isAdmin ? admin : student).map(([url, label, icon]) => (
            <a className={current === url ? "active" : ""} key={url} href={"/" + url}>
              <Icon name={icon} size={18} />
              {label}
            </a>
          ))}
        </nav>
        <div className="side-label">Conta</div>
        <nav>
          <a href="/perfil" className={part === "perfil" ? "active" : ""}>
            <Icon name="user" size={18} />
            Meu perfil
          </a>
          <a href="/notificacoes" className={part === "notificacoes" ? "active" : ""}>
            <Icon name="bell" size={18} />
            Notificações {unread > 0 && <b>{unread}</b>}
          </a>
          {p.role === "admin" && (
            <a href={isAdmin ? "/dashboard" : "/admin"}>
              <Icon name={isAdmin ? "cap" : "settings"} size={18} />
              {isAdmin ? "Área do aluno" : "Administração"}
            </a>
          )}
        </nav>
        <div className="side-bottom">
          <span className="avatar">{p.photo ? <img src={p.photo} alt="" /> : p.name[0]}</span>
          <div>
            <strong>{p.name}</strong>
            <small>{p.role === "admin" ? "Administrador" : "Aluno"}</small>
          </div>
          <button className="icon-btn" onClick={logout} aria-label="Sair da conta" title="Sair">
            <Icon name="logout" size={17} />
          </button>
        </div>
      </aside>
      <main id="principal" className="work-main">
        <header className="work-top">
          <span>
            LógicaLab <Icon name="next" size={13} />
            {isAdmin ? "Administração" : "Área do aluno"}
          </span>
          <a className="icon-btn" href="/notificacoes" aria-label="Notificações">
            <Icon name="bell" size={19} />
            {unread > 0 && <i />}
          </a>
        </header>
        <div className="work-content">
          <Notice text={error} />
          {part === "boas-vindas" ? (
            <Onboard profile={p} />
          ) : part === "dashboard" ? (
            <Dashboard data={state} profile={p} />
          ) : part === "curso" ? (
            <Course data={state} id={id === "modulo" ? path[2] : undefined} />
          ) : part === "aula" ? (
            <Lesson data={state} id={id} />
          ) : part === "exercicio" ? (
            <ExercisePage id={id} />
          ) : part === "quiz" ? (
            <QuizPage id={id} />
          ) : part === "progresso" ? (
            <Progress data={state} />
          ) : part === "perfil" ? (
            <Profile session={sess.value} />
          ) : part === "feedback" ? (
            <Feedback data={state} />
          ) : part === "notificacoes" ? (
            <>
              <PageTitle over="Sua conta" title="Notificações" />
              <div className="panel">
                {state.notes.length ? (
                  <>
                    {unread > 0 && (
                      <button
                        className="text-link"
                        onClick={async () => {
                          try {
                            await api("notifications", {});
                            data.reload();
                          } catch (e: any) {
                            err(e.message);
                          }
                        }}
                      >
                        <Icon name="checks" size={16} />
                        Marcar todas como lidas
                      </button>
                    )}
                    {state.notes.map((n: Row) => (
                      <div className="activity" key={n.id}>
                        <Icon name={n.seen ? "checks" : "bell"} size={17} />
                        <div>
                          {n.message}
                          <small>{dateBR(n.created, true)}</small>
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <Empty text="Nenhuma notificação por enquanto." />
                )}
              </div>
            </>
          ) : isAdmin && p.role === "admin" ? (
            id === "usuarios" ? (
              <AdminUsers
                id={path[2]}
                count={(state.modules as Module[]).flatMap((x) => x.lessons).length}
              />
            ) : id === "conteudos" ? (
              <Contents education={sess.value.education} />
            ) : (
              <Reports home={!id} />
            )
          ) : (
            <Empty
              text={
                route.startsWith("admin")
                  ? "Área exclusiva da administração."
                  : "Página não encontrada."
              }
            />
          )}
        </div>
      </main>
    </div>
  );
}
