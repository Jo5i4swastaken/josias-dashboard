import { randomInt } from "node:crypto";
import { EMAIL_CODE_MAX_ATTEMPTS, EMAIL_CODE_TTL_MS, EMAIL_RESEND_COOLDOWN_MS } from "@/lib/constants";
import { hashOneTimeCode } from "@/lib/crypto";
import { HttpError } from "@/lib/errors";
import { safeEqualHex } from "@/lib/safe-equal";
import { getKv } from "@/lib/store";
import type { EmailCodeRecord } from "@/lib/types";

const EMAIL_KEY = "email:code";

export async function getEmailCode(): Promise<EmailCodeRecord | null> {
  return getKv().get<EmailCodeRecord>(EMAIL_KEY);
}

export async function issueEmailCode(now: number): Promise<string> {
  const existing = await getEmailCode();
  if (existing && now - existing.sentAt < EMAIL_RESEND_COOLDOWN_MS) {
    const wait = Math.ceil((EMAIL_RESEND_COOLDOWN_MS - (now - existing.sentAt)) / 1000);
    throw new HttpError(429, `Wait ${wait} seconds before sending another code.`, wait);
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const record: EmailCodeRecord = {
    hash: hashOneTimeCode(code),
    expiresAt: now + EMAIL_CODE_TTL_MS,
    attempts: 0,
    used: false,
    sentAt: now,
  };
  await getKv().set(EMAIL_KEY, record);
  return code;
}

export async function consumeEmailCode(code: string, now: number): Promise<void> {
  const record = await getEmailCode();
  if (!record || record.used || now >= record.expiresAt) {
    throw new HttpError(401, "That code is invalid or expired.");
  }
  if (record.attempts >= EMAIL_CODE_MAX_ATTEMPTS) {
    throw new HttpError(429, "Too many attempts. Send a new code.");
  }

  const match = safeEqualHex(record.hash, hashOneTimeCode(code));
  if (!match) {
    const attempts = record.attempts + 1;
    await getKv().set(EMAIL_KEY, { ...record, attempts });
    if (attempts >= EMAIL_CODE_MAX_ATTEMPTS) {
      throw new HttpError(429, "Too many attempts. Send a new code.");
    }
    throw new HttpError(401, "That code is invalid or expired.");
  }

  await getKv().set(EMAIL_KEY, { ...record, used: true });
}

export function emailCodeMessage(code: string): { subject: string; text: string } {
  return {
    subject: "Your Josias sign-in code",
    text: [
      `Your Josias dashboard sign-in code is ${code}.`,
      "",
      "It expires in 10 minutes and works only once.",
      "If you didn't try to sign in, you can ignore this message.",
    ].join("\n"),
  };
}
