import type { RateLimitRecord } from "@/lib/types";
import { getKv } from "@/lib/store";

export type LimitResult = { ok: true } | { ok: false; retryAt: number };

export async function checkLimit(
  key: string,
  now: number,
  max: number,
  windowMs: number,
): Promise<LimitResult> {
  const current = await getKv().get<RateLimitRecord>(key);
  if (!current || now - current.windowStart >= windowMs) {
    return { ok: true };
  }
  if (current.count >= max) {
    return { ok: false, retryAt: current.windowStart + windowMs };
  }
  return { ok: true };
}

export async function recordFailure(key: string, now: number, windowMs: number): Promise<number> {
  const next = await getKv().update<RateLimitRecord>(key, (current) => {
    if (!current || now - current.windowStart >= windowMs) {
      return { count: 1, windowStart: now };
    }
    return { count: current.count + 1, windowStart: current.windowStart };
  });
  return next?.count ?? 1;
}

export async function clearLimit(key: string): Promise<void> {
  await getKv().del(key);
}
