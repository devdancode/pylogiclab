import { Home } from "../ui/landing";
import { courseSummary } from "../server/db";
import { identity, account } from "../server/account";
export const dynamic = "force-dynamic";
export default async function Page() {
  const [summary, u] = await Promise.all([courseSummary(), identity()]);
  const p = u ? await account(u) : null;
  return <Home {...summary} member={!!p?.active} />;
}
