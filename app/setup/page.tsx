import Link from "next/link";
import { ConfigNotice } from "@/components/config-notice";
import { SetupWizard } from "@/components/setup-wizard";
import { isSetupComplete } from "@/lib/user";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  let complete = false;
  try {
    complete = await isSetupComplete();
  } catch {
    return <ConfigNotice />;
  }

  if (complete) {
    return (
      <main className="auth">
        <div className="auth-card closed">
          <p className="mark">Josias</p>
          <h1>Setup is finished</h1>
          <p className="lede">This page has been turned off. It will not run again.</p>
          <Link className="btn btn-primary" href="/login">
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  return <SetupWizard />;
}
