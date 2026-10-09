import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions } from "@/lib/session-options";

export { sessionOptions, sessionPassword } from "@/lib/session-options";

export type AuthSession = {
  username?: string;
  authenticated?: boolean;
};

export type PendingSession = {
  username?: string;
  issuedAt?: number;
};

export type SetupSession = {
  nonce?: string;
};

export async function readSession() {
  return getIronSession<AuthSession>(await cookies(), sessionOptions("session"));
}

export async function readPending() {
  return getIronSession<PendingSession>(await cookies(), sessionOptions("pending"));
}

export async function readSetupSession() {
  return getIronSession<SetupSession>(await cookies(), sessionOptions("setup"));
}
