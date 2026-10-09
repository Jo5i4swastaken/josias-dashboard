import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { authenticatePassword, beginSetup, confirmSetup, deliveryEmail, sendLoginEmail, verifyEmailLogin, verifyRecoveryLogin, verifyTotpLogin } from "@/lib/auth";
import { LOGIN_WINDOW_MS } from "@/lib/constants";
import { HttpError } from "@/lib/errors";
import { readDevInbox } from "@/lib/mailer";
import { decryptTotpSecret, totpFor } from "@/lib/totp";
import { getUser } from "@/lib/user";
import { useTempStore } from "./helpers";

const password = "correct-horse-battery";
const start = Date.parse("2026-10-08T15:00:00.000Z");

async function setupAccount(now = start) {
  const started = await beginSetup({
    token: "test-setup-token",
    username: "Josias",
    password,
    email: "josias@example.com",
    now,
  });
  const user = await getUser();
  const secret = decryptTotpSecret(user!.totpSecretEnc);
  const code = totpFor(secret, "josias").generate({ timestamp: now });
  const recoveryCodes = await confirmSetup(started.nonce, code, now);
  return { secret, recoveryCodes };
}

describe("auth flows", () => {
  let cleanup: () => void;

  beforeEach(() => {
    cleanup = useTempStore();
    delete process.env.DASHBOARD_2FA_EMAIL;
  });

  afterEach(() => {
    delete process.env.DASHBOARD_2FA_EMAIL;
    cleanup();
  });

  it("rejects a bad setup token and a short password", async () => {
    await expect(
      beginSetup({
        token: "wrong-token",
        username: "josias",
        password,
        email: "josias@example.com",
      }),
    ).rejects.toThrow(/Setup token/);

    await expect(
      beginSetup({
        token: "test-setup-token",
        username: "josias",
        password: "short",
        email: "josias@example.com",
      }),
    ).rejects.toThrow(/at least 10/);
  });

  it("finishes setup once, then signs in with password, TOTP, email, and a recovery code", async () => {
    const { secret, recoveryCodes } = await setupAccount();
    expect(recoveryCodes).toHaveLength(8);
    expect((await getUser())?.setupComplete).toBe(true);
    expect((await getUser())?.username).toBe("josias");

    await expect(
      beginSetup({
        token: "test-setup-token",
        username: "josias",
        password,
        email: "josias@example.com",
      }),
    ).rejects.toBeInstanceOf(HttpError);

    await expect(authenticatePassword("josias", "not-the-password", start)).rejects.toThrow(/Incorrect/);
    await expect(authenticatePassword("Josias", password, start + 1)).resolves.toEqual({ username: "josias" });

    const totpNow = start + 60_000;
    const totpCode = totpFor(secret, "josias").generate({ timestamp: totpNow });
    await verifyTotpLogin("josias", totpCode, totpNow);
    await expect(verifyTotpLogin("josias", totpCode, totpNow)).rejects.toThrow(/already used/);

    await sendLoginEmail("josias", totpNow + 1000);
    const message = readDevInbox();
    expect(message?.to).toBe("josias@example.com");
    const emailCode = message?.text.match(/\b(\d{6})\b/)?.[1];
    expect(emailCode).toBeTruthy();
    await verifyEmailLogin("josias", emailCode!, totpNow + 2000);
    await expect(verifyEmailLogin("josias", emailCode!, totpNow + 3000)).rejects.toThrow(/invalid or expired/);

    await verifyRecoveryLogin("josias", recoveryCodes[0]!, totpNow + 4000);
    await expect(verifyRecoveryLogin("josias", recoveryCodes[0]!, totpNow + 5000)).rejects.toThrow(/already used/);
    expect((await getUser())?.recoveryCodes.filter((record) => record.used)).toHaveLength(1);
  });

  it("rate limits password attempts to 5 per 15 minutes", async () => {
    await setupAccount();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(authenticatePassword("josias", "wrong-password", start + 120_000 + attempt)).rejects.toThrow(
        /Incorrect/,
      );
    }
    await expect(authenticatePassword("josias", password, start + 130_000)).rejects.toThrow(/Too many attempts/);
    await expect(authenticatePassword("josias", password, start + 120_000 + LOGIN_WINDOW_MS)).resolves.toEqual({
      username: "josias",
    });
  });

  it("sends email codes to DASHBOARD_2FA_EMAIL when that override is set", async () => {
    await setupAccount();
    process.env.DASHBOARD_2FA_EMAIL = "backup@example.com";
    expect(deliveryEmail((await getUser())!)).toBe("backup@example.com");
    await sendLoginEmail("josias", start + 90_000);
    expect(readDevInbox()?.to).toBe("backup@example.com");
  });
});
