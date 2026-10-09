import { hash, verify, type Algorithm } from "@node-rs/argon2";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/constants";
import { HttpError } from "@/lib/errors";

/** 2 is Argon2id. The package exports it as a const enum, which isolatedModules cannot read. */
const ARGON2ID: Algorithm = 2;

export const ARGON2_OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

let dummyHashPromise: Promise<string> | null = null;

function dummyHash(): Promise<string> {
  dummyHashPromise ??= hash("josias-dashboard-dummy-password", ARGON2_OPTIONS);
  return dummyHashPromise;
}

export function assertPasswordPolicy(password: string): void {
  if (password.length < PASSWORD_MIN) {
    throw new HttpError(400, `Password must be at least ${PASSWORD_MIN} characters.`);
  }
  if (password.length > PASSWORD_MAX) {
    throw new HttpError(400, `Password must be at most ${PASSWORD_MAX} characters.`);
  }
}

export async function hashPassword(password: string): Promise<string> {
  assertPasswordPolicy(password);
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash: string | null, password: string): Promise<boolean> {
  if (password.length > PASSWORD_MAX) {
    return false;
  }
  const hashed = passwordHash ?? (await dummyHash());
  return verify(hashed, password);
}
