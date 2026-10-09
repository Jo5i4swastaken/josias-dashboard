import { randomBytes } from "node:crypto";
import QRCode from "qrcode";
import {
  LOGIN_MAX_ATTEMPTS,
  LOGIN_WINDOW_MS,
  SECOND_FACTOR_MAX_ATTEMPTS,
  SECOND_FACTOR_WINDOW_MS,
} from "@/lib/constants";
import { hashOneTimeCode } from "@/lib/crypto";
import { consumeEmailCode, emailCodeMessage, issueEmailCode } from "@/lib/email-code";
import { HttpError, tooManyAttempts } from "@/lib/errors";
import { maskEmail, sendEmail } from "@/lib/mailer";
import { hashPassword, verifyPassword } from "@/lib/password";
import { checkLimit, clearLimit, recordFailure } from "@/lib/rate-limit";
import { consumeRecoveryCode, generateRecoveryCodes, hashRecoveryCodes } from "@/lib/recovery";
import { safeEqual } from "@/lib/safe-equal";
import { checkTotp, createTotpSecret, decryptTotpSecret, encryptTotpSecret, groupSecret, totpFailure, totpFor } from "@/lib/totp";
import type { UserRecord } from "@/lib/types";
import { getUser, parseUsername, saveUser } from "@/lib/user";
import { seedDashboard } from "@/lib/dashboard";

const MAX_TOKEN_LENGTH = 512;

export type SetupStartResult = {
  qrDataUrl: string;
  otpauthUrl: string;
  manualKey: string;
};

function loginKey(username: string): string {
  return `ratelimit:login:${username}`;
}

function totpKey(username: string): string {
  return `ratelimit:totp:${username}`;
}

function recoveryKey(username: string): string {
  return `ratelimit:recovery:${username}`;
}

const SETUP_TOTP_KEY = "ratelimit:setup-totp";

function assertSetupToken(presented: string): void {
  const expected = process.env.DASHBOARD_SETUP_TOKEN ?? "";
  if (
    !presented ||
    !expected ||
    presented.length > MAX_TOKEN_LENGTH ||
    expected.length > MAX_TOKEN_LENGTH ||
    !safeEqual(presented, expected)
  ) {
    throw new HttpError(401, "Setup token is incorrect.");
  }
}

export function parseEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  if (trimmed.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    throw new HttpError(400, "Enter a valid email address.");
  }
  return trimmed;
}

export function deliveryEmail(user: UserRecord): string {
  const override = process.env.DASHBOARD_2FA_EMAIL?.trim().toLowerCase();
  return override || user.email;
}

async function guard(key: string, now: number, max: number, windowMs: number): Promise<void> {
  const limit = await checkLimit(key, now, max, windowMs);
  if (!limit.ok) {
    throw tooManyAttempts(limit.retryAt, now);
  }
}

export async function authenticatePassword(
  usernameInput: string,
  password: string,
  now = Date.now(),
): Promise<{ username: string }> {
  const username = parseUsername(usernameInput);
  await guard(loginKey(username), now, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS);

  const user = await getUser();
  const usernameMatches = user ? safeEqual(user.username, username) : false;
  const passwordMatches = await verifyPassword(
    user && usernameMatches ? user.passwordHash : null,
    password,
  );

  if (!user || !usernameMatches || !passwordMatches) {
    await recordFailure(loginKey(username), now, LOGIN_WINDOW_MS);
    throw new HttpError(401, "Incorrect username or password.");
  }

  if (!user.setupComplete) {
    throw new HttpError(403, "Finish setup before signing in.");
  }

  await clearLimit(loginKey(username));
  return { username: user.username };
}

async function requireReadyUser(username: string): Promise<UserRecord> {
  const user = await getUser();
  if (!user || !user.setupComplete || !safeEqual(user.username, username)) {
    throw new HttpError(401, "Sign in with your password first.");
  }
  return user;
}

export async function verifyTotpLogin(username: string, token: string, now = Date.now()): Promise<void> {
  await guard(totpKey(username), now, SECOND_FACTOR_MAX_ATTEMPTS, SECOND_FACTOR_WINDOW_MS);
  const user = await requireReadyUser(username);
  const secret = decryptTotpSecret(user.totpSecretEnc);
  const result = checkTotp(secret, token, user.totpLastStep, now);
  if (!result.ok) {
    await recordFailure(totpKey(username), now, SECOND_FACTOR_WINDOW_MS);
    throw totpFailure(result.reason);
  }
  await saveUser({ ...user, totpLastStep: result.step });
  await clearLimit(totpKey(username));
}

export async function sendLoginEmail(username: string, now = Date.now()): Promise<{ maskedEmail: string }> {
  const user = await requireReadyUser(username);
  const code = await issueEmailCode(now);
  const to = deliveryEmail(user);
  const message = emailCodeMessage(code);
  await sendEmail({ to, ...message });
  return { maskedEmail: maskEmail(to) };
}

export async function verifyEmailLogin(username: string, code: string, now = Date.now()): Promise<void> {
  await requireReadyUser(username);
  await consumeEmailCode(code, now);
}

export async function verifyRecoveryLogin(username: string, code: string, now = Date.now()): Promise<void> {
  await guard(recoveryKey(username), now, SECOND_FACTOR_MAX_ATTEMPTS, SECOND_FACTOR_WINDOW_MS);
  const user = await requireReadyUser(username);
  try {
    const next = consumeRecoveryCode(user, code);
    await saveUser(next);
  } catch (error) {
    await recordFailure(recoveryKey(username), now, SECOND_FACTOR_WINDOW_MS);
    throw error;
  }
  await clearLimit(recoveryKey(username));
}

export async function beginSetup(input: {
  token: string;
  username: string;
  password: string;
  email: string;
  now?: number;
}): Promise<SetupStartResult & { nonce: string }> {
  if (await isAlreadySetup()) {
    throw new HttpError(403, "Setup is already finished and cannot be run again.");
  }
  assertSetupToken(input.token);
  const username = parseUsername(input.username);
  const email = parseEmail(input.email);
  const passwordHash = await hashPassword(input.password);
  const secret = createTotpSecret();
  const nonce = randomBytes(16).toString("hex");
  const user: UserRecord = {
    username,
    passwordHash,
    email,
    totpSecretEnc: encryptTotpSecret(secret),
    totpLastStep: null,
    recoveryCodes: [],
    setupComplete: false,
    setupNonceHash: hashOneTimeCode(nonce),
    createdAt: new Date(input.now ?? Date.now()).toISOString(),
  };
  await saveUser(user);

  const otpauthUrl = totpFor(secret, username).toString();
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl, {
    margin: 1,
    width: 280,
    errorCorrectionLevel: "M",
  });
  return {
    qrDataUrl,
    otpauthUrl,
    manualKey: groupSecret(secret.base32),
    nonce,
  };
}

export async function confirmSetup(nonce: string | undefined, token: string, now = Date.now()): Promise<string[]> {
  if (await isAlreadySetup()) {
    throw new HttpError(403, "Setup is already finished and cannot be run again.");
  }
  const user = await getUser();
  if (!user || !nonce || !user.setupNonceHash || !safeEqual(user.setupNonceHash, hashOneTimeCode(nonce))) {
    throw new HttpError(401, "Setup session expired. Start again.");
  }

  await guard(SETUP_TOTP_KEY, now, SECOND_FACTOR_MAX_ATTEMPTS, SECOND_FACTOR_WINDOW_MS);
  const secret = decryptTotpSecret(user.totpSecretEnc);
  const result = checkTotp(secret, token, user.totpLastStep, now);
  if (!result.ok) {
    await recordFailure(SETUP_TOTP_KEY, now, SECOND_FACTOR_WINDOW_MS);
    throw totpFailure(result.reason);
  }

  const codes = generateRecoveryCodes();
  await saveUser({
    ...user,
    totpLastStep: result.step,
    recoveryCodes: hashRecoveryCodes(codes),
    setupComplete: true,
    setupNonceHash: null,
  });
  await clearLimit(SETUP_TOTP_KEY);
  await seedDashboard(now);
  return codes;
}

async function isAlreadySetup(): Promise<boolean> {
  const user = await getUser();
  return Boolean(user?.setupComplete);
}
