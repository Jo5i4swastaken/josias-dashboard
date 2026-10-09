import type { SessionOptions } from "iron-session";
import {
  PENDING_COOKIE,
  PENDING_TTL_SECONDS,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  SETUP_COOKIE,
  SETUP_TTL_SECONDS,
} from "@/lib/constants";

export function sessionPassword(): string {
  const password = process.env.DASHBOARD_SESSION_SECRET ?? "";
  if (password.length < 32) {
    throw new Error(
      "DASHBOARD_SESSION_SECRET must be at least 32 characters. Generate one with: openssl rand -base64 32",
    );
  }
  return password;
}

export function sessionOptions(kind: "session" | "pending" | "setup" = "session"): SessionOptions {
  const ttl =
    kind === "session" ? SESSION_TTL_SECONDS : kind === "pending" ? PENDING_TTL_SECONDS : SETUP_TTL_SECONDS;
  const cookieName = kind === "session" ? SESSION_COOKIE : kind === "pending" ? PENDING_COOKIE : SETUP_COOKIE;
  return {
    password: sessionPassword(),
    cookieName,
    ttl,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
  };
}
