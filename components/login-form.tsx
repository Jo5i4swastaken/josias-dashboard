"use client";

import Link from "next/link";
import { useState } from "react";

type Step = "password" | "choose" | "totp" | "email" | "recovery";

async function post(path: string, body?: unknown): Promise<{ error?: string; maskedEmail?: string }> {
  const response = await fetch(path, {
    method: "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string; maskedEmail?: string };
  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }
  return data;
}

export function LoginForm({ setupComplete }: { setupComplete: boolean }) {
  const [step, setStep] = useState<Step>("password");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
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
        <h1>{step === "password" ? "Sign in" : "Second step"}</h1>
        <p className="lede">
          {step === "password"
            ? "This desk is private."
            : "Password accepted. Confirm it's you."}
        </p>
        <ol className="steps">
          <li className={step === "password" ? "on" : undefined}>1 Password</li>
          <li className={step === "password" ? undefined : "on"}>2 Confirm</li>
        </ol>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}

        {step === "password" ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                await post("/api/auth/login", { username, password });
                setCode("");
                setStep("choose");
              });
            }}
          >
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
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            <button className="btn btn-primary" type="submit" disabled={pending}>
              {pending ? "Checking…" : "Continue"}
            </button>
          </form>
        ) : null}

        {step === "choose" ? (
          <div className="choice-list">
            <button className="choice recommended" type="button" onClick={() => setStep("totp")}>
              <span className="badge">Recommended</span>
              <strong>Authenticator app</strong>
              <span>6-digit code from the app you set up.</span>
            </button>
            <button
              className="choice"
              type="button"
              disabled={pending}
              onClick={() => {
                void run(async () => {
                  const result = await post("/api/auth/email/send");
                  setMaskedEmail(result.maskedEmail ?? "your email");
                  setCode("");
                  setStep("email");
                });
              }}
            >
              <strong>Email me a code</strong>
              <span>Fallback. A 6-digit code that expires in 10 minutes.</span>
            </button>
            <button className="choice" type="button" onClick={() => setStep("recovery")}>
              <strong>Recovery code</strong>
              <span>One of the eight codes saved at setup. Each works once.</span>
            </button>
          </div>
        ) : null}

        {step === "totp" ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                await post("/api/auth/totp", { code });
                window.location.assign("/");
              });
            }}
          >
            <label className="field">
              <span>Authenticator code</span>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                required
              />
            </label>
            <button className="btn btn-primary" type="submit" disabled={pending}>
              {pending ? "Checking…" : "Open the week"}
            </button>
            <button className="btn btn-ghost back" type="button" onClick={() => setStep("choose")}>
              Choose another way
            </button>
          </form>
        ) : null}

        {step === "email" ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                await post("/api/auth/email/verify", { code });
                window.location.assign("/");
              });
            }}
          >
            <p className="hint">Sent to {maskedEmail}. It expires in 10 minutes and works once.</p>
            <label className="field">
              <span>Email code</span>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                required
              />
            </label>
            <button className="btn btn-primary" type="submit" disabled={pending}>
              {pending ? "Checking…" : "Open the week"}
            </button>
            <button
              className="btn btn-ghost back"
              type="button"
              disabled={pending}
              onClick={() => {
                void run(async () => {
                  const result = await post("/api/auth/email/send");
                  setMaskedEmail(result.maskedEmail ?? maskedEmail);
                });
              }}
            >
              Resend code
            </button>
            <button className="btn btn-ghost back" type="button" onClick={() => setStep("choose")}>
              Choose another way
            </button>
          </form>
        ) : null}

        {step === "recovery" ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                await post("/api/auth/recovery", { code });
                window.location.assign("/");
              });
            }}
          >
            <label className="field">
              <span>Recovery code</span>
              <input
                autoComplete="one-time-code"
                spellCheck={false}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                required
              />
            </label>
            <button className="btn btn-primary" type="submit" disabled={pending}>
              {pending ? "Checking…" : "Open the week"}
            </button>
            <button className="btn btn-ghost back" type="button" onClick={() => setStep("choose")}>
              Choose another way
            </button>
          </form>
        ) : null}

        {setupComplete ? null : (
          <p className="setup-link">
            First time here? <Link className="link" href="/setup">Set up this desk</Link>
          </p>
        )}
      </div>
    </main>
  );
}
