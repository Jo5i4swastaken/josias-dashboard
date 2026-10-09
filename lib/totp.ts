import { Secret, TOTP } from "otpauth";
import { TOTP_ALGORITHM, TOTP_DIGITS, TOTP_ISSUER, TOTP_PERIOD_SECONDS, TOTP_WINDOW } from "@/lib/constants";
import { decryptString, encryptString } from "@/lib/crypto";
import { HttpError } from "@/lib/errors";

export type TotpCheck =
  | { ok: true; step: number }
  | { ok: false; reason: "invalid" | "replay" };

export function createTotpSecret(): Secret {
  return new Secret({ size: 20 });
}

export function totpFor(secret: Secret | string, username: string): TOTP {
  return new TOTP({
    issuer: TOTP_ISSUER,
    label: username,
    algorithm: TOTP_ALGORITHM,
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD_SECONDS,
    secret,
  });
}

export function encryptTotpSecret(secret: Secret): string {
  return encryptString(secret.base32);
}

export function decryptTotpSecret(packed: string): Secret {
  return Secret.fromBase32(decryptString(packed));
}

export function groupSecret(base32: string): string {
  return base32.replace(/(.{4})/g, "$1 ").trim();
}

/**
 * RFC 6238 validation with a ±1 step window for clock skew.
 * A step that has already been accepted is rejected so the same code cannot be replayed.
 */
export function checkTotp(
  secret: Secret,
  token: string,
  lastStep: number | null,
  now: number,
): TotpCheck {
  const normalized = token.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) {
    return { ok: false, reason: "invalid" };
  }
  const totp = totpFor(secret, "user");
  const delta = totp.validate({ token: normalized, timestamp: now, window: TOTP_WINDOW });
  if (delta === null) {
    return { ok: false, reason: "invalid" };
  }
  const counter = Math.floor(now / 1000 / TOTP_PERIOD_SECONDS);
  const step = counter + delta;
  if (lastStep !== null && step <= lastStep) {
    return { ok: false, reason: "replay" };
  }
  return { ok: true, step };
}

export function totpFailure(reason: "invalid" | "replay"): HttpError {
  if (reason === "replay") {
    return new HttpError(401, "That code was already used. Wait for a new one from your app.");
  }
  return new HttpError(401, "That code doesn't match.");
}
