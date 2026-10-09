import { randomBytes } from "node:crypto";
import { RECOVERY_CODE_COUNT } from "@/lib/constants";
import { hashOneTimeCode } from "@/lib/crypto";
import { HttpError } from "@/lib/errors";
import { safeEqualHex } from "@/lib/safe-equal";
import type { RecoveryCodeRecord, UserRecord } from "@/lib/types";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  return Array.from({ length: count }, () => {
    const bytes = randomBytes(8);
    let raw = "";
    for (let index = 0; index < 8; index += 1) {
      raw += ALPHABET[bytes[index]! % ALPHABET.length];
    }
    return `${raw.slice(0, 4)}-${raw.slice(4)}`;
  });
}

export function hashRecoveryCodes(codes: string[]): RecoveryCodeRecord[] {
  return codes.map((code) => ({ hash: hashOneTimeCode(code), used: false }));
}

/**
 * Walks every code and does not return early, so a match doesn't shorten the compare.
 * Returns the updated user with that code marked used.
 */
export function consumeRecoveryCode(user: UserRecord, presented: string): UserRecord {
  const digest = hashOneTimeCode(presented);
  let found = -1;
  for (let index = 0; index < user.recoveryCodes.length; index += 1) {
    const record = user.recoveryCodes[index]!;
    const equal = safeEqualHex(record.hash, digest);
    if (equal && !record.used && found === -1) {
      found = index;
    }
  }
  if (found === -1) {
    throw new HttpError(401, "That recovery code is invalid or already used.");
  }
  return {
    ...user,
    recoveryCodes: user.recoveryCodes.map((record, index) =>
      index === found ? { ...record, used: true } : record,
    ),
  };
}
