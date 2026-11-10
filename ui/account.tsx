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
}: {
  data: Row;
  set: (v: Row) => void;
  education: string[];
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
            } as Row
          )[k]
        }
        readOnly={k === "email"}
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
    </>
  );
}
function Consent({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="consent">
      <input
        type="checkbox"
        checked={checked}
        required
        onChange={(e) => onChange(e.target.checked)}
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
    if (qs.has("error") || hash.has("error")) {
      history.replaceState(null, "", location.pathname);
      err(
        "Este link expirou ou já foi utilizado. Entre com sua senha ou solicite um novo link de recuperação.",
      );
      return;
    }
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
    enroll = kind === "matricula",
    recover = kind === "recuperar-senha",
    newpass = kind === "nova-senha",
    confirm = kind === "confirmar",
    login = kind === "login";
  const data = session.value,
    profile = data?.profile;
  useEffect(() => {
    if (enroll && data && !data.identity) location.replace("/login?next=%2Fmatricula");
    if (enroll && profile?.active) location.replace("/dashboard");
  }, [enroll, data, profile]);
  const title = register
    ? "Crie sua conta"
    : enroll
    ? "Conclua sua matrícula"
    : recover
    ? "Recupere seu acesso"
    : newpass
    ? "Defina uma nova senha"
    : confirm
    ? "Confirmação de e-mail"
    : "Boas-vindas de volta";
  const description = register
    ? "Cadastre seu e-mail e escolha uma senha para estudar na LógicaLab."
    : enroll
    ? "Conte um pouco sobre você para começar sua trilha."
    : recover
    ? "Informe o e-mail da sua conta para receber o link de recuperação."
    : newpass
    ? "Escolha a nova senha que você usará para entrar."
    : confirm
    ? "Valide seu e-mail para acessar a plataforma."
    : "Entre com o e-mail e a senha que você cadastrou na LógicaLab.";
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    err("");
    msg("");
    if (register || newpass) {
      if (d.password !== d.confirm) {
        err("As senhas não coincidem.");
        return;
      }
      if (d.password.length < 8 || !/[a-zA-ZÀ-ÿ]/.test(d.password) || !/[0-9]/.test(d.password)) {
        err("Use pelo menos oito caracteres, uma letra e um número.");
        return;
      }
    }
    wait(true);
    try {
      const action = register
        ? "signup"
        : enroll
        ? "enroll"
        : recover
        ? "recover"
        : newpass
        ? "password"
        : "login";
      const fields = register
        ? { email: d.email, password: d.password, confirm: d.confirm, consent: d.consent }
        : enroll
        ? d
        : recover
        ? { email: d.email }
        : newpass
        ? { password: d.password, confirm: d.confirm }
        : { email: d.email, password: d.password };
      const result = await api("auth/" + action, fields);
      if (result.next) location.assign(login ? safeNext() : result.next);
      else {
        msg(result.message);
        finish(true);
      }
    } catch (e: any) {
      err(e.message);
    } finally {
      wait(false);
    }
  }
  const setField = (key: string, value: string | boolean) =>
    set((prev) => ({ ...prev, [key]: value }));
  return (
    <>
      <Header current="conta" member={!!profile?.active} />
      <main id="principal" className="authpage">
        <section className={"authcard" + (enroll ? " wide" : "")}>
          <a className="back" href="/">
            <Icon name="left" size={16} />
            Início
          </a>
          <span className="auth-emblem">
            <Icon
              name={register || enroll ? "cap" : recover || newpass ? "lock" : "terminal"}
              size={25}
            />
          </span>
          <PageTitle title={title} desc={description} />
          <Notice text={error || session.error} />
          <Notice text={message} success />
          {done || confirm ? (
            <a className="btn ghost" href="/login">
              Voltar para o login
            </a>
          ) : (register || login) && profile?.active ? (
            <>
              <p className="muted">Você está conectado como {profile.name}.</p>
              <a className="btn primary" href={profile.onboarded ? safeNext() : "/boas-vindas"}>
                Ir para minha área <Icon name="arrow" size={16} />
              </a>
            </>
          ) : enroll && !data?.identity ? (
            <Loading />
          ) : (
            <form onSubmit={submit}>
              {enroll ? (
                <>
                  <ProfileFields data={d} set={set} education={data.education} />
                  {!data.consented && (
                    <Consent checked={d.consent} onChange={(value) => setField("consent", value)} />
                  )}
                </>
              ) : (
                <>
                  {!newpass && (
                    <Field label="E-mail">
                      <input
                        name="email"
                        type="email"
                        autoComplete="username"
                        required
                        maxLength={254}
                        value={d.email}
                        onChange={(e) => setField("email", e.target.value)}
                      />
                    </Field>
                  )}
                  {!recover && (
                    <Field label={newpass ? "Nova senha" : "Senha"}>
                      <input
                        name="password"
                        type="password"
                        autoComplete={register || newpass ? "new-password" : "current-password"}
                        required
                        minLength={register || newpass ? 8 : 1}
                        maxLength={128}
                        value={d.password}
                        onChange={(e) => setField("password", e.target.value)}
                      />
                    </Field>
                  )}
                  {(register || newpass) && (
                    <>
                      <Field label="Confirme a senha">
                        <input
                          name="confirm"
                          type="password"
                          autoComplete="new-password"
                          required
                          minLength={8}
                          maxLength={128}
                          value={d.confirm}
                          onChange={(e) => setField("confirm", e.target.value)}
                        />
                      </Field>
                      <small>Use pelo menos oito caracteres, uma letra e um número.</small>
                    </>
                  )}
                  {register && (
                    <Consent checked={d.consent} onChange={(value) => setField("consent", value)} />
                  )}
                  {login && (
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
                  : enroll
                  ? "Concluir matrícula"
                  : recover
                  ? "Enviar link de recuperação"
                  : newpass
                  ? "Salvar nova senha"
                  : "Entrar"}
                <Icon name="arrow" size={16} />
              </button>
            </form>
          )}
          {!done && !confirm && !enroll && (
            <div className="auth-foot">
              {login ? (
                <span>
                  Primeiro acesso? <a href="/cadastro">Criar conta gratuita</a>
                </span>
              ) : (
                <a href="/login">Voltar para o login</a>
              )}
            </div>
          )}
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
