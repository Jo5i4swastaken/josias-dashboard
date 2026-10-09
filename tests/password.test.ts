import { describe, expect, it } from "vitest";
import { parseOptions } from "@node-rs/argon2";
import { PASSWORD_MIN } from "@/lib/constants";
import { HttpError } from "@/lib/errors";
import { ARGON2_OPTIONS, assertPasswordPolicy, hashPassword, verifyPassword } from "@/lib/password";

describe("password hashing", () => {
  it("hashes with argon2id and verifies only the right password", async () => {
    const password = "correct-horse-battery";
    const hashed = await hashPassword(password);
    expect(hashed.startsWith("$argon2id$")).toBe(true);
    expect(hashed).not.toContain(password);
    expect(parseOptions(hashed).algorithm).toBe(2);
    expect(parseOptions(hashed).memoryCost).toBe(ARGON2_OPTIONS.memoryCost);
    expect(await verifyPassword(hashed, password)).toBe(true);
    expect(await verifyPassword(hashed, "wrong-password-here")).toBe(false);
  });

  it("rejects a short password before hashing", () => {
    expect(() => assertPasswordPolicy("short")).toThrow(HttpError);
    expect(() => assertPasswordPolicy("x".repeat(PASSWORD_MIN - 1))).toThrow(/at least 10/);
  });

  it("still runs a verify when the account hash is missing", async () => {
    expect(await verifyPassword(null, "anything-at-all")).toBe(false);
  });
});
