import { createRoot } from "react-dom/client";
import { AccountPage } from "../../ui/account";
import { Home, PublicTrail } from "../../ui/landing";
import { Policy } from "../../ui/policies";
import { Workspace } from "../../ui/workspace";
import { Brand, Header, Loading, Notice, useRemote } from "../../ui/common";
import { accountPages, pageNames } from "../../lib/routes";
import "../../app/globals.css";

const path = location.pathname.split("/").filter(Boolean);
const part = path[0] || "";
if (part) document.title = (pageNames[part] || "Página não encontrada") + " | LógicaLab";

function PublicPage() {
  const session = useRemote("session");
  const legal = part === "termos" || part === "privacidade";
  const course = useRemote(legal ? null : "formation");
  const member = !!session.value?.profile?.active;
  if (legal) return <Policy privacy={part === "privacidade"} member={member} />;
  if (!course.value)
    return (
      <>
        <div className="wrapper loading-brand">
          <Brand />
        </div>
        <main id="principal" className="wrapper">
          {course.error ? <Notice text={course.error} /> : <Loading />}
        </main>
      </>
    );
  if (part === "trilha")
    return <PublicTrail modules={course.value.modules} id={path[1]} member={member} />;
  return (
    <Home
      modules={course.value.modules}
      exerciseCount={course.value.exerciseCount}
      member={member}
    />
  );
}
function Portal() {
  if (accountPages.includes(part) || part === "matricula") return <AccountPage kind={part} />;
  if (["", "trilha", "termos", "privacidade"].includes(part)) return <PublicPage />;
  if (Object.hasOwn(pageNames, part)) return <Workspace path={path} />;
  return (
    <>
      <Header />
      <main id="principal" className="wrapper legal">
        <h1>Página não encontrada</h1>
        <a href="/">Voltar ao início</a>
      </main>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<Portal />);
