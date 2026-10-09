import { redirect } from "next/navigation";
import { ConfigNotice } from "@/components/config-notice";
import { LoginForm } from "@/components/login-form";
import { readSession } from "@/lib/session";
import { isSetupComplete } from "@/lib/user";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  let session: Awaited<ReturnType<typeof readSession>>;
  try {
    session = await readSession();
  } catch {
    return <ConfigNotice />;
  }

  if (session.authenticated) {
    redirect("/");
  }

  const setupComplete = await isSetupComplete();
  return <LoginForm setupComplete={setupComplete} />;
}
