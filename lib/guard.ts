import { PENDING_TTL_SECONDS } from "@/lib/constants";
import { HttpError } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/origin";
import { readPending, readSession, readSetupSession } from "@/lib/session";

export async function requireUser(req: Request): Promise<string> {
  if (req.method === "GET" || req.method === "HEAD") {
    const site = req.headers.get("sec-fetch-site");
    if (site && site !== "same-origin" && site !== "none") {
      throw new HttpError(403, "Cross-origin request blocked.");
    }
  } else {
    assertSameOrigin(req);
  }
  const session = await readSession();
  if (!session.authenticated || !session.username) {
    throw new HttpError(401, "Unauthorized.");
  }
  return session.username;
}

export async function requirePendingUsername(req: Request, now = Date.now()): Promise<string> {
  assertSameOrigin(req);
  const pending = await readPending();
  if (!pending.username || !pending.issuedAt) {
    throw new HttpError(401, "Sign in with your password first.");
  }
  if (now - pending.issuedAt > PENDING_TTL_SECONDS * 1000) {
    pending.destroy();
    throw new HttpError(401, "That sign-in expired. Start again.");
  }
  return pending.username;
}

export async function requireSetupNonce(req: Request): Promise<string> {
  assertSameOrigin(req);
  const setup = await readSetupSession();
  if (!setup.nonce) {
    throw new HttpError(401, "Setup session expired. Start again.");
  }
  return setup.nonce;
}

export async function establishSession(username: string): Promise<void> {
  const session = await readSession();
  session.username = username;
  session.authenticated = true;
  await session.save();
  const pending = await readPending();
  pending.destroy();
  const setup = await readSetupSession();
  setup.destroy();
}
