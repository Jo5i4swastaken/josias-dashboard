import { describe, expect, it } from "vitest";
import { TOTP_ISSUER } from "@/lib/constants";
import { decryptString, encryptString } from "@/lib/crypto";
import { checkTotp, createTotpSecret, decryptTotpSecret, encryptTotpSecret, totpFor } from "@/lib/totp";

describe("TOTP", () => {
  it("encrypts the secret at rest and round-trips it", () => {
    const secret = createTotpSecret();
    const packed = encryptTotpSecret(secret);
    expect(packed).not.toContain(secret.base32);
    expect(decryptTotpSecret(packed).base32).toBe(secret.base32);
  });

  it("rejects a tampered ciphertext", () => {
    const packed = encryptString("hello-secret");
    const bytes = Buffer.from(packed, "base64");
    bytes[bytes.length - 1] ^= 0xff;
    expect(() => decryptString(bytes.toString("base64"))).toThrow();
  });

  it("accepts a current code once and rejects a replay", () => {
    const now = Date.parse("2026-10-08T15:00:00.000Z");
    const secret = createTotpSecret();
    const code = totpFor(secret, "josias").generate({ timestamp: now });
    const first = checkTotp(secret, code, null, now);
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    const replay = checkTotp(secret, code, first.step, now);
    expect(replay).toEqual({ ok: false, reason: "replay" });
  });

  it("accepts the next time step after the previous code was used", () => {
    const now = Date.parse("2026-10-08T15:00:00.000Z");
    const secret = createTotpSecret();
    const totp = totpFor(secret, "josias");
    const firstCode = totp.generate({ timestamp: now });
    const first = checkTotp(secret, firstCode, null, now);
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    const later = now + 30_000;
    const nextCode = totp.generate({ timestamp: later });
    const second = checkTotp(secret, nextCode, first.step, later);
    expect(second.ok).toBe(true);
  });

  it("rejects a wrong code and builds a JosiasDashboard otpauth URI", () => {
    const now = Date.parse("2026-10-08T15:00:00.000Z");
    const secret = createTotpSecret();
    expect(checkTotp(secret, "000000", null, now).ok).toBe(false);
    const uri = totpFor(secret, "josias").toString();
    expect(uri.startsWith("otpauth://totp/")).toBe(true);
    expect(uri).toContain(TOTP_ISSUER);
    expect(uri).toContain("josias");
  });
});
