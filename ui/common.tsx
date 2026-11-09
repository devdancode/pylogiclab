"use client";
import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  ArrowDown,
  BookOpen,
  Layers,
  CodeXml,
  Terminal,
  BrainCircuit,
  Workflow,
  Boxes,
  Calculator,
  Split,
  Repeat2,
  List,
  Braces,
  Rocket,
  Clock3,
  MapPin,
  GraduationCap,
  Menu,
  X,
  LockKeyhole,
  Check,
  CheckCircle2,
  Play,
  FileCode2,
  Route,
  LayoutDashboard,
  ChartNoAxesColumnIncreasing,
  UserRound,
  MessageSquare,
  Bell,
  LogOut,
  Users,
  Settings2,
  ClipboardList,
  Star,
  Eye,
  Plus,
  Trash2,
  Download,
  Copy,
  Lightbulb,
  Target,
  BookMarked,
  ExternalLink,
  Award,
  Search,
  CheckCheck,
  Pencil,
  FlaskConical,
  Inbox,
  ShieldCheck,
  Save,
  CalendarDays,
  Mail,
  SquareTerminal,
  ChevronsRight,
  SlidersHorizontal,
} from "lucide-react";
import type { Module } from "../lib/model";
const icons = {
  arrow: ArrowRight,
  left: ArrowLeft,
  out: ArrowUpRight,
  down: ChevronDown,
  next: ChevronRight,
  lower: ArrowDown,
  book: BookOpen,
  layers: Layers,
  code: CodeXml,
  terminal: Terminal,
  brain: BrainCircuit,
  route: Workflow,
  boxes: Boxes,
  calculator: Calculator,
  split: Split,
  repeat: Repeat2,
  list: List,
  function: Braces,
  rocket: Rocket,
  clock: Clock3,
  pin: MapPin,
  cap: GraduationCap,
  menu: Menu,
  x: X,
  lock: LockKeyhole,
  check: Check,
  done: CheckCircle2,
  play: Play,
  file: FileCode2,
  trail: Route,
  dashboard: LayoutDashboard,
  chart: ChartNoAxesColumnIncreasing,
  user: UserRound,
  message: MessageSquare,
  bell: Bell,
  logout: LogOut,
  users: Users,
  settings: Settings2,
  quiz: ClipboardList,
  star: Star,
  eye: Eye,
  plus: Plus,
  trash: Trash2,
  download: Download,
  copy: Copy,
  bulb: Lightbulb,
  target: Target,
  marked: BookMarked,
  external: ExternalLink,
  award: Award,
  search: Search,
  checks: CheckCheck,
  edit: Pencil,
  lab: FlaskConical,
  inbox: Inbox,
  shield: ShieldCheck,
  save: Save,
  calendar: CalendarDays,
  mail: Mail,
  console: SquareTerminal,
  chevrons: ChevronsRight,
  filter: SlidersHorizontal,
};
export function Icon({
  name,
  size = 20,
  ...attrs
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const C = icons[name as keyof typeof icons] || icons.code;
  return <C size={size} strokeWidth={1.75} aria-hidden="true" {...attrs} />;
}
export function Brand() {
  return (
    <a className="brand" href="/" aria-label="LógicaLab, início">
      <span className="brandmark">
        <Icon name="code" size={24} />
      </span>
      <span>
        Lógica<span className="brand-blue">Lab</span>
      </span>
    </a>
  );
}
export function Header({
  current = "inicio",
  member = false,
}: {
  current?: string;
  member?: boolean;
}) {
  const [open, set] = useState(false);
  return (
    <header className="topbar">
      <div className="wrapper navrow">
        <Brand />
        <nav className={open ? "public-nav open" : "public-nav"} aria-label="Navegação principal">
          {[
            ["inicio", "Início", "/"],
            ["trilha", "Trilha de aprendizagem", "/trilha"],
            ["sobre", "Sobre o projeto", "/#projeto"],
          ].map(([i, l, h]) => (
            <a key={i} className={current === i ? "on" : ""} href={h} onClick={() => set(false)}>
              {l}
            </a>
          ))}
        </nav>
        <div className="top-actions">
          {member ? (
            <a className="btn compact primary" href="/dashboard">
              Meu painel <Icon name="arrow" size={16} />
            </a>
          ) : (
            <>
              <a className="login-link" href="/login">
                Entrar
              </a>
              <a className="btn compact primary" href="/cadastro">
                Criar conta <Icon name="arrow" size={16} />
              </a>
            </>
          )}
          <button
            className="mobile-toggle"
            aria-label="Menu de navegação"
            aria-expanded={open}
            onClick={() => set(!open)}
          >
            <Icon name={open ? "x" : "menu"} />
          </button>
        </div>
      </div>
    </header>
  );
}
export function Footer() {
  return (
    <footer>
      <div className="wrapper footer-in">
        <Brand />
        <p>Projeto de extensão · Pirassununga, SP</p>
        <div>
          <a href="/termos">Termos de uso</a>
          <a href="/privacidade">Privacidade</a>
        </div>
      </div>
    </footer>
  );
}
export function NumberTag({ n }: { n: number }) {
  return <span className="eyebrow">Módulo {String(n).padStart(2, "0")}</span>;
}
export function ModeIcon({ m }: { m: Module }) {
  return (
    <span className={"modeicon tone" + ((m.position - 1) % 5)}>
      <Icon name={m.icon} size={25} />
    </span>
  );
}
export function PythonCode({ code, name = "exemplo.py" }: { code: string; name?: string }) {
  const [copied, set] = useState(false);
  const pattern =
    /(#[^\n]*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\b(?:def|return|for|in|if|else|elif|while|break|and|or|not|True|False|None|import)\b|\b(?:print|input|int|float|len|range|str|list|sum|round)\b|\b\d+(?:\.\d+)?\b)/g;
  return (
    <div className="code-panel">
      <div className="code-head">
        <span>
          <i />
          <i />
          <i />
          {name}
        </span>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              set(true);
              setTimeout(() => set(false), 1600);
            } catch {
              set(false);
            }
          }}
          aria-label="Copiar código"
        >
          <Icon name={copied ? "check" : "copy"} size={15} />
        </button>
      </div>
      <pre>
        <code>
          {code.split(pattern).map((part, i) => {
            const cl = part.startsWith("#")
              ? "comment"
              : /^["']/.test(part)
              ? "string"
              : /^\d/.test(part)
              ? "num"
              : i % 2
              ? "key"
              : "";
            return (
              <span key={i} className={cl}>
                {part}
              </span>
            );
          })}
        </code>
      </pre>
    </div>
  );
}
export function Bar({ value }: { value: number }) {
  return (
    <span
      className="progressbar"
      role="progressbar"
      aria-label="Progresso"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
    >
      <i style={{ width: value + "%" }} />
    </span>
  );
}
export function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <Icon name="inbox" />
      <p>{text}</p>
    </div>
  );
}
export function Notice({ text, success = false }: { text: string; success?: boolean }) {
  return text ? (
    <p className={success ? "notice success" : "notice"} role={success ? "status" : "alert"}>
      {text}
    </p>
  ) : null;
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <span />
      Carregando…
    </div>
  );
}
export async function api(path: string, body?: unknown): Promise<any> {
  const res = await fetch("/api/" + path, {
    credentials: "same-origin",
    cache: "no-store",
    ...(body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  const v = (await res.json()) as any;
  if (!res.ok) throw new Error(v.error || "Não foi possível carregar os dados.");
  return v;
}
export function useRemote(path: string | null) {
  const [value, set] = useState<any>(null),
    [error, setError] = useState(""),
    [step, refresh] = useState(0);
  useEffect(() => {
    let active = true;
    set(null);
    setError("");
    if (path)
      api(path)
        .then((x) => {
          if (active) set(x);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [path, step]);
  return { value, error, reload: () => refresh((x) => x + 1), set };
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function PageTitle({ over, title, desc }: { over?: string; title: string; desc?: string }) {
  return (
    <div className="page-title">
      {over && <span className="eyebrow">{over}</span>}
      <h1>{title}</h1>
      {desc && <p>{desc}</p>}
    </div>
  );
}
