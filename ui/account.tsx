"use client";
import React, { useEffect, useState } from "react";
import { api, Field, Header, Footer, Icon, Loading, Notice, PageTitle, useRemote } from "./common";
import { experiences, states, weeklyOptions, type Row } from "../lib/model";
const defaults = {
  name: "",
  email: "",
  phone: "",
  birth: "",
  city: "",
  state: "",
  education: "",
  area: "",
  experience: "Nunca programei",
  goal: "",
  photo: "",
  password: "",
  confirm: "",
  consent: false,
};
export function ProfileFields({
  data,
  set,
  education,
  registration = false,
  provider = false,
}: {
  data: Row;
  set: (v: Row) => void;
  education: string[];
  registration?: boolean;
  provider?: boolean;
}) {
  const change = (k: string, v: any) => set({ ...data, [k]: v });
  const input = (k: string, label: string, type = "text", required = true, max = 150) => (
    <Field label={label}>
      <input
        type={type}
        value={data[k] || ""}
        required={required}
        maxLength={max}
        autoComplete={
          (
            {
              name: "name",
              email: "email",
              phone: "tel",
              city: "address-level2",
              password: "new-password",
              confirm: "new-password",
            } as Row
          )[k]
        }
        readOnly={k === "email" && (!registration || !provider)}
        minLength={k === "password" || k === "confirm" ? 8 : undefined}
        max={type === "date" ? new Date().toISOString().slice(0, 10) : undefined}
        onChange={(e) => change(k, e.target.value)}
      />
    </Field>
  );
  const select = (k: string, label: string, choices: string[]) => (
    <Field label={label}>
      <select value={data[k] || ""} required onChange={(e) => change(k, e.target.value)}>
        <option value="">Selecione</option>
        {choices.map((x) => (
          <option key={x}>{x}</option>
        ))}
      </select>
    </Field>
  );
  return (
    <>
      <h3>Dados pessoais</h3>
      <div className="form-grid">
        {input("name", "Nome completo")}
        {input("email", "E-mail", "email")}
        {input("phone", "Telefone com DDD", "tel")}
        {input("birth", "Data de nascimento", "date")}
        {input("city", "Cidade")}
        {select("state", "Estado", states)}
      </div>
      <h3>Seu aprendizado</h3>
      <div className="form-grid">
        {select(
          "education",
          "Escolaridade",
          Array.from(new Set([...education, ...(data.education ? [data.education] : [])])),
        )}
        {select("experience", "Experiência com programação", experiences)}
        {input("area", "Área de atuação ou estudo (opcional)", "text", false)}
        <Field label="Objetivo com o curso (opcional)">
          <input
            value={data.goal || ""}
            maxLength={800}
            onChange={(e) => change("goal", e.target.value)}
          />
        </Field>
      </div>
      {registration && provider && (
        <>
          <h3>Senha de acesso</h3>
          <div className="form-grid">
            {input("password", "Senha", "password")}
            {input("confirm", "Confirme a senha", "password")}
          </div>
          <small>Use pelo menos oito caracteres, uma letra e um número.</small>
        </>
      )}
      {registration && (
        <label className="consent">
          <input
            type="checkbox"
            checked={!!data.consent}
            required
            onChange={(e) => change("consent", e.target.checked)}
          />
          <span>
            Li e aceito os{" "}
            <a href="/termos" target="_blank" rel="noreferrer">
              Termos de uso
            </a>{" "}
            e a{" "}
            <a href="/privacidade" target="_blank" rel="noreferrer">
              Política de privacidade
            </a>
            .
          </span>
        </label>
      )}
    </>
  );
}
function safeNext() {
  const n = new URLSearchParams(location.search).get("next");
  return n && n.startsWith("/") && !n.startsWith("//") && !n.includes("\\") ? n : "/dashboard";
}
export function AccountPage({ kind }: { kind: string }) {
  const session = useRemote("session"),
    [d, set] = useState<Row>({ ...defaults }),
    [error, err] = useState(""),
    [message, msg] = useState(""),
    [busy, wait] = useState(false),
    [done, finish] = useState(false);
  useEffect(() => {
    const i = session.value?.identity;
    if (i) set((v) => ({ ...v, email: i.email || v.email, name: i.name || v.name }));
  }, [session.value]);
  useEffect(() => {
    if (kind !== "confirmar" && kind !== "login" && kind !== "nova-senha") return;
    const qs = new URLSearchParams(location.search),
      hash = new URLSearchParams(location.hash.slice(1));
    if (qs.has("token_hash") || hash.has("access_token")) {
      wait(true);
      const action = qs.has("token_hash") ? "verify" : "exchange",
        params =
          action === "verify"
            ? { token: qs.get("token_hash"), type: qs.get("type") }
            : {
                access: hash.get("access_token"),
                refresh: hash.get("refresh_token"),
                type: hash.get("type"),
              };
      history.replaceState(null, "", location.pathname);
      api("auth/" + action, params)
        .then((x) => {
          location.replace(x.next);
        })
        .catch((e) => {
          err(e.message);
          wait(false);
        });
    }
  }, [kind]);
  const register = kind === "cadastro",
    recover = kind === "recuperar-senha",
    newpass = kind === "nova-senha",
    confirm = kind === "confirmar";
  const title = register
    ? "Crie sua conta"
    : recover
    ? "Recupere seu acesso"
    : newpass
    ? "Defina uma nova senha"
    : confirm
    ? "Confirme seu e-mail"
    : "Boas-vindas de volta";
  const data = session.value,
    provider = data?.provider,
    identity = data?.identity,
    profile = data?.profile;
  const redirectNative =
    "/signin-with-chatgpt?return_to=" +
    encodeURIComponent(register ? "/cadastro" : recover ? "/login" : "/dashboard");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    err("");
    msg("");
    if (
      (register || newpass) &&
      provider &&
      (d.password !== d.confirm || !/[a-zA-ZÀ-ÿ]/.test(d.password) || !/[0-9]/.test(d.password))
    ) {
      err("Use uma letra, um número e confirme a mesma senha.");
      return;
    }
    wait(true);
    try {
      const result = await api(
        "auth/" + (register ? "signup" : recover ? "recover" : newpass ? "password" : "login"),
        d,
      );
      if (result.next)
        location.assign(!register && !recover && !newpass ? safeNext() : result.next);
      else {
        msg(result.message);
        finish(true);
      }
    } catch (x: any) {
      err(x.message);
    } finally {
      wait(false);
    }
  }
  return (
    <>
      <Header current="conta" member={!!profile} />
      <main id="principal" className="authpage">
        <section
          className={
            "authcard" + (register && data && (provider || identity) && !profile ? " wide" : "")
          }
        >
          <a className="back" href="/">
            <Icon name="left" size={16} />
            Início
          </a>
          <span className="auth-emblem">
            <Icon name={register ? "cap" : recover || newpass ? "lock" : "terminal"} size={25} />
          </span>
          <PageTitle
            title={title}
            desc={
              register
                ? "Faça sua matrícula gratuita para começar a trilha de programação."
                : recover
                ? "Retome o acesso à sua área de estudos."
                : newpass
                ? "Escolha uma senha com pelo menos oito caracteres."
                : confirm
                ? "Estamos validando seu link de confirmação."
                : "Acesse sua trilha, seus exercícios e seu progresso."
            }
          />
          <Notice text={error || session.error} />
          <Notice text={message} success />
          {!data && !session.error ? (
            <Loading />
          ) : (
            data &&
            (!done ? (
              confirm ? (
                <div>
                  {!busy && (
                    <a className="btn ghost" href="/login">
                      Ir para o acesso
                    </a>
                  )}
                </div>
              ) : !provider && (recover || newpass) ? (
                <>
                  <p className="muted">
                    Sua identidade é gerenciada pelo ChatGPT. Na tela de acesso da sua conta,
                    utilize a opção de recuperação de senha do seu provedor.
                  </p>
                  <a className="btn primary" target="_top" href={redirectNative}>
                    Acessar minha conta <Icon name="out" size={16} />
                  </a>
                </>
              ) : profile && (register || kind === "login") ? (
                <>
                  <p className="muted">Você está conectado como {profile.name}.</p>
                  <a className="btn primary" href={profile.onboarded ? safeNext() : "/boas-vindas"}>
                    Ir para minha área <Icon name="arrow" size={16} />
                  </a>
                </>
              ) : !provider && (!register || !identity) ? (
                <>
                  <p className="muted">
                    {identity
                      ? "Sua identidade já foi confirmada. Conclua a matrícula para iniciar seus estudos."
                      : "Use sua conta ChatGPT para confirmar sua identidade e acessar a plataforma."}
                  </p>
                  <a
                    className="btn primary fullbtn"
                    target="_top"
                    href={identity ? "/cadastro" : redirectNative}
                  >
                    {identity ? "Concluir minha matrícula" : "Continuar com o ChatGPT"}
                    <Icon name="arrow" size={17} />
                  </a>
                  <a className="form-link" href="/recuperar-senha">
                    Preciso recuperar meu acesso
                  </a>
                </>
              ) : (
                <form onSubmit={submit}>
                  {register ? (
                    <ProfileFields
                      data={d}
                      set={set}
                      education={data.education}
                      registration
                      provider={provider}
                    />
                  ) : (
                    <>
                      {!newpass && (
                        <Field label="E-mail">
                          <input
                            type="email"
                            required
                            autoComplete="email"
                            value={d.email}
                            onChange={(e) => set({ ...d, email: e.target.value })}
                          />
                        </Field>
                      )}
                      {!recover && (
                        <Field label={newpass ? "Nova senha" : "Senha"}>
                          <input
                            type="password"
                            required
                            minLength={newpass ? 8 : 1}
                            autoComplete={newpass ? "new-password" : "current-password"}
                            value={d.password}
                            onChange={(e) => set({ ...d, password: e.target.value })}
                          />
                        </Field>
                      )}
                      {newpass && (
                        <Field label="Confirme a nova senha">
                          <input
                            type="password"
                            required
                            value={d.confirm}
                            onChange={(e) => set({ ...d, confirm: e.target.value })}
                          />
                        </Field>
                      )}
                      {!newpass && !recover && (
                        <a className="form-link" href="/recuperar-senha">
                          Esqueci minha senha
                        </a>
                      )}
                    </>
                  )}
                  <button disabled={busy} className="btn primary fullbtn">
                    {busy
                      ? "Aguarde…"
                      : register
                      ? "Criar conta gratuita"
                      : recover
                      ? "Enviar link de recuperação"
                      : newpass
                      ? "Salvar nova senha"
                      : "Entrar"}
                    <Icon name="arrow" size={16} />
                  </button>
                </form>
              )
            ) : (
              <a className="btn ghost" href="/login">
                Voltar ao acesso
              </a>
            ))
          )}
          <div className="auth-foot">
            {data?.emailAvailable && !profile && (register || kind === "login") && (
              <p className="alternate-access">
                <a
                  target="_top"
                  href={
                    "/api/access/" +
                    (provider ? "sites" : "email") +
                    "?to=" +
                    (register ? "cadastro" : "login")
                  }
                >
                  {provider ? "Continuar com o ChatGPT" : "Usar e-mail e senha"}
                </a>
              </p>
            )}
            {register || recover || newpass ? (
              <a href="/login">Voltar para o login</a>
            ) : (
              <span>
                Primeiro acesso? <a href="/cadastro">Criar conta gratuita</a>
              </span>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
export function Onboard({ profile }: { profile: Row }) {
  const [d, set] = useState({
      experience: profile.experience,
      goal: profile.goal || "",
      weekly: profile.weekly || "",
    }),
    [error, err] = useState(""),
    [busy, wait] = useState(false);
  return (
    <div className="panel narrow">
      <PageTitle
        over="Primeiro acesso"
        title="Bem-vindo à plataforma!"
        desc="Conte um pouco sobre você para começar sua primeira aula."
      />
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          wait(true);
          try {
            const v = await api("profile/onboard", d);
            location.assign(v.next);
          } catch (e: any) {
            err(e.message);
            wait(false);
          }
        }}
      >
        <Field label="Você já estudou programação?">
          <select
            required
            value={d.experience}
            onChange={(e) => set({ ...d, experience: e.target.value })}
          >
            {experiences.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Field>
        <Field label="Qual é seu principal objetivo?">
          <textarea
            maxLength={800}
            required
            value={d.goal}
            onChange={(e) => set({ ...d, goal: e.target.value })}
          />
        </Field>
        <Field label="Quanto tempo pretende estudar por semana?">
          <select required value={d.weekly} onChange={(e) => set({ ...d, weekly: e.target.value })}>
            <option value="">Selecione</option>
            {weeklyOptions.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Field>
        <Notice text={error} />
        <button className="btn primary" disabled={busy}>
          Começar o primeiro módulo <Icon name="arrow" size={17} />
        </button>
      </form>
    </div>
  );
}
