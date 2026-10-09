import { redirect } from "next/navigation";
import { ConfigNotice } from "@/components/config-notice";
import { Dashboard } from "@/components/dashboard";
import { getUiView } from "@/lib/dashboard";
import { readSession } from "@/lib/session";
import { isSetupComplete } from "@/lib/user";

export const dynamic = "force-dynamic";

export default async function WeekPage() {
  let session: Awaited<ReturnType<typeof readSession>>;
  try {
    session = await readSession();
  } catch {
    return <ConfigNotice />;
  }

  if (!session.authenticated || !session.username) {
    redirect("/login");
  }

  const [ready, view] = await Promise.all([isSetupComplete(), getUiView()]);
  if (!ready) {
    redirect("/setup");
  }

  return <Dashboard username={session.username} initial={view} layout="week" />;
}
