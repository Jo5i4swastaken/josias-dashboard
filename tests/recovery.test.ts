import { describe, expect, it } from "vitest";
import { RECOVERY_CODE_COUNT } from "@/lib/constants";
import { HttpError } from "@/lib/errors";
import { consumeRecoveryCode, generateRecoveryCodes, hashRecoveryCodes } from "@/lib/recovery";
import type { UserRecord } from "@/lib/types";

function userWith(codes: string[]): UserRecord {
  return {
    username: "josias",
    passwordHash: "hash",
    email: "josias@example.com",
    totpSecretEnc: "enc",
    totpLastStep: null,
    recoveryCodes: hashRecoveryCodes(codes),
    setupComplete: true,
    setupNonceHash: null,
    createdAt: "2026-10-08T00:00:00.000Z",
  };
}

describe("recovery codes", () => {
  it("creates 8 single-use codes and stores only hashes", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(RECOVERY_CODE_COUNT);
    for (const code of codes) {
      expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    }
    const hashes = hashRecoveryCodes(codes);
    expect(JSON.stringify(hashes)).not.toContain(codes[0]);
    expect(hashes.every((record) => record.used === false && record.hash.length === 64)).toBe(true);
  });

  it("accepts a code once, including a different spelling, and rejects a second use", () => {
    const codes = generateRecoveryCodes();
    const user = userWith(codes);
    const presented = codes[3]!.toLowerCase().replace("-", " ");
    const used = consumeRecoveryCode(user, presented);
    expect(used.recoveryCodes.filter((record) => record.used)).toHaveLength(1);
    expect(used.recoveryCodes[3]?.used).toBe(true);
    expect(() => consumeRecoveryCode(used, codes[3]!)).toThrow(HttpError);
    expect(() => consumeRecoveryCode(used, "ZZZZ-ZZZZ")).toThrow(/invalid or already used/);
  });
});
