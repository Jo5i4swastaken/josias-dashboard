import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export function getEncKey(): Buffer {
  const raw = process.env.DASHBOARD_ENC_KEY?.trim();
  if (!raw) {
    throw new Error("DASHBOARD_ENC_KEY is not set. Generate one with: openssl rand -base64 32");
  }

  const key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("DASHBOARD_ENC_KEY must be 32 bytes. Generate one with: openssl rand -base64 32");
  }
  return key;
}

/** AES-256-GCM. Packed as base64(iv || authTag || ciphertext). */
export function encryptString(plain: string, key: Buffer = getEncKey()): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

export function decryptString(packed: string, key: Buffer = getEncKey()): string {
  const buf = Buffer.from(packed, "base64");
  if (buf.length < IV_LENGTH + TAG_LENGTH + 1) {
    throw new Error("Encrypted value is malformed");
  }
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function normalizeOneTimeCode(code: string): string {
  return code.trim().toLowerCase().replace(/[\s-]/g, "");
}

/** HMAC-SHA256 so a storage leak does not reveal one-time codes. */
export function hashOneTimeCode(code: string, key: Buffer = getEncKey()): string {
  return createHmac("sha256", key).update(normalizeOneTimeCode(code)).digest("hex");
}
