import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
import { identity, account, hasProvider } from "../../server/account";
import { catalog } from "../../server/db";
import { PublicTrail } from "../../ui/landing";
import { Policy } from "../../ui/policies";
import { AccountPage } from "../../ui/account";
import { Workspace } from "../../ui/workspace";
import { pageNames, accountPages } from "../../lib/routes";
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return { title: pageNames[path[0]] || "Página não encontrada" };
}
export default async function Page({ params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const part = path[0];
  if (!pageNames[part]) notFound();
  if (accountPages.includes(part)) return <AccountPage kind={part} />;
  const u = await identity(),
    p = u ? await account(u) : null;
  if (part === "matricula") {
    if (!u && !(await cookies()).get("ll_refresh")) redirect("/login?next=%2Fmatricula");
    if (p?.active) redirect("/dashboard");
    return <AccountPage kind="matricula" />;
  }
  if (part === "trilha")
    return <PublicTrail modules={await catalog()} id={path[1]} member={!!p?.active} />;
  if (part === "termos" || part === "privacidade")
    return <Policy privacy={part === "privacidade"} member={!!p?.active} />;
  if (!u) {
    if (hasProvider() && (await cookies()).get("ll_refresh")) return <Workspace path={path} />;
    redirect("/login?next=" + encodeURIComponent("/" + path.join("/")));
  }
  if (!p) {
    if (hasProvider()) return <Workspace path={path} />;
    redirect("/matricula");
  }
  if (!p.active) redirect("/login");
  if (part === "admin" && p.role !== "admin") redirect("/dashboard");
  if (!p.onboarded && part !== "boas-vindas") redirect("/boas-vindas");
  return <Workspace path={path} />;
}
