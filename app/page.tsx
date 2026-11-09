import { Home } from "../ui/landing";
import { catalog, first } from "../server/db";
import { identity, account } from "../server/account";
export const dynamic = "force-dynamic";
export default async function Page() {
  const modules = await catalog();
  const [u, count] = await Promise.all([
    identity(),
    first(
      "SELECT count(*) n FROM exercises e JOIN lessons l ON l.id=e.lesson_id JOIN modules m ON m.id=l.module_id WHERE l.published=1 AND m.published=1",
    ),
  ]);
  const p = u ? await account(u) : null;
  return <Home modules={modules} exerciseCount={Number(count?.n || 0)} member={!!p?.active} />;
}
