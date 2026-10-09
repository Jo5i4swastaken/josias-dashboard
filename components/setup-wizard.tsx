"use client";

import { useState } from "react";

type Phase = "details" | "qr" | "codes";

type StartResponse = {
  qrDataUrl: string;
  otpauthUrl: string;
  manualKey: string;
  error?: string;
};

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }
  return data;
}

export function SetupWizard() {
  const [phase, setPhase] = useState<Phase>("details");
  const [token, setToken] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [email, setEmail] = useState("");
  const [qr, setQr] = useState<StartResponse | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function run(fn: () => Promise<void>) {
    setError(null);
    setPending(true);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="auth">
      <div className="auth-card">
        <p className="mark">Josias</p>
        <h1>{phase === "codes" ? "Save these codes" : "Set up this desk"}</h1>
        <p className="lede">
          {phase === "codes"
            ? "These eight recovery codes are shown once. Each one signs you in a single time if you lose the authenticator."
            : "This page works once. After you confirm the authenticator, it shuts itself off."}
        </p>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}

        {phase === "details" ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                if (password !== confirm) {
                  throw new Error("Those passwords don't match.");
                }
                const result = await postJson<StartResponse>("/api/setup/start", {
                  token,
                  username,
                  password,
                  email,
                });
                setQr(result);
                setCode("");
                setPhase("qr");
              });
            }}
          >
            <label className="field">
              <span>Setup token</span>
              <input
                name="token"
                autoComplete="off"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>Username</span>
              <input
                name="username"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={10}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>Confirm password</span>
              <input
                name="confirm"
                type="password"
                autoComplete="new-password"
                minLength={10}
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                required
              />
            </label>
            <p className="hint">At least 10 characters.</p>
            <label className="field">
              <span>Email for sign-in codes</span>
              <input
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <button className="btn btn-primary" type="submit" disabled={pending}>
              {pending ? "Preparing…" : "Continue"}
            </button>
          </form>
        ) : null}

        {phase === "qr" && qr ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                const result = await postJson<{ recoveryCodes: string[] }>("/api/setup/confirm", { code });
                setCodes(result.recoveryCodes);
                setPhase("codes");
              });
            }}
          >
            <p className="hint">Scan with an authenticator app. The issuer is JosiasDashboard.</p>
            <img className="qr" src={qr.qrDataUrl} alt="QR code for the JosiasDashboard authenticator" />
            <p className="hint">Or enter this key by hand. Spaces don't matter.</p>
            <p className="secret">{qr.manualKey}</p>
            <label className="field">
              <span>Code from the app</span>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                required
              />
            </label>
            <button className="btn btn-primary" type="submit" disabled={pending}>
              {pending ? "Checking…" : "Confirm and finish setup"}
            </button>
            <button className="btn btn-ghost back" type="button" onClick={() => setPhase("details")}>
              Start over
            </button>
          </form>
        ) : null}

        {phase === "codes" ? (
          <div>
            <ul className="codes">
              {codes.map((entry) => (
                <li key={entry}>{entry}</li>
              ))}
            </ul>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(codes.join("\n"));
              }}
            >
              Copy codes
            </button>
            <label className="checkline">
              <input type="checkbox" checked={saved} onChange={(event) => setSaved(event.target.checked)} />
              <span>I saved these codes somewhere I can find later.</span>
            </label>
            <button
              className="btn btn-primary"
              type="button"
              disabled={!saved}
              onClick={() => window.location.assign("/")}
            >
              Open the week
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
