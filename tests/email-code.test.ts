import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EMAIL_CODE_TTL_MS, EMAIL_RESEND_COOLDOWN_MS } from "@/lib/constants";
import { consumeEmailCode, getEmailCode, issueEmailCode } from "@/lib/email-code";
import { HttpError } from "@/lib/errors";
import { useTempStore } from "./helpers";

describe("emailed sign-in codes", () => {
  let cleanup: () => void;
  const start = Date.parse("2026-10-08T15:00:00.000Z");

  beforeEach(() => {
    cleanup = useTempStore();
  });

  afterEach(() => {
    cleanup();
  });

  it("stores a hash, accepts the code once, and rejects it after that", async () => {
    const code = await issueEmailCode(start);
    expect(code).toMatch(/^\d{6}$/);
    const stored = await getEmailCode();
    expect(stored?.hash).not.toBe(code);
    expect(stored?.hash).toHaveLength(64);
    expect(JSON.stringify(stored)).not.toContain(`"${code}"`);

    await consumeEmailCode(code, start + 1000);
    await expect(consumeEmailCode(code, start + 2000)).rejects.toBeInstanceOf(HttpError);
  });

  it("expires after 10 minutes", async () => {
    const code = await issueEmailCode(start);
    await expect(consumeEmailCode(code, start + EMAIL_CODE_TTL_MS)).rejects.toThrow(/invalid or expired/);
  });

  it("locks the code after 5 wrong attempts", async () => {
    const code = await issueEmailCode(start);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await expect(consumeEmailCode("000000", start + attempt)).rejects.toThrow(/invalid or expired/);
    }
    await expect(consumeEmailCode("000000", start + 10)).rejects.toThrow(/Too many attempts/);
    await expect(consumeEmailCode(code, start + 11)).rejects.toThrow(/Too many attempts/);
  });

  it("enforces a 60 second resend cooldown and invalidates the previous code", async () => {
    const first = await issueEmailCode(start);
    await expect(issueEmailCode(start + EMAIL_RESEND_COOLDOWN_MS - 1000)).rejects.toThrow(/Wait/);
    const second = await issueEmailCode(start + EMAIL_RESEND_COOLDOWN_MS);
    expect(second).not.toBe(first);
    await expect(consumeEmailCode(first, start + EMAIL_RESEND_COOLDOWN_MS + 1)).rejects.toThrow(/invalid or expired/);
    await consumeEmailCode(second, start + EMAIL_RESEND_COOLDOWN_MS + 2);
  });
});
