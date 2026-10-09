import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS } from "@/lib/constants";
import { checkLimit, clearLimit, recordFailure } from "@/lib/rate-limit";
import { useTempStore } from "./helpers";

describe("rate limit", () => {
  let cleanup: () => void;
  const key = "ratelimit:login:josias";
  const start = Date.parse("2026-10-08T15:00:00.000Z");

  beforeEach(() => {
    cleanup = useTempStore();
  });

  afterEach(() => {
    cleanup();
  });

  it("allows 5 attempts in a 15 minute window and blocks the next one", async () => {
    for (let attempt = 0; attempt < LOGIN_MAX_ATTEMPTS; attempt += 1) {
      expect(await checkLimit(key, start, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS)).toEqual({ ok: true });
      await recordFailure(key, start + attempt, LOGIN_WINDOW_MS);
    }
    const blocked = await checkLimit(key, start + 1000, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.retryAt).toBe(start + LOGIN_WINDOW_MS);
    }
  });

  it("opens the window again after 15 minutes and after a successful clear", async () => {
    for (let attempt = 0; attempt < LOGIN_MAX_ATTEMPTS; attempt += 1) {
      await recordFailure(key, start, LOGIN_WINDOW_MS);
    }
    expect((await checkLimit(key, start + LOGIN_WINDOW_MS, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS)).ok).toBe(true);

    await recordFailure(key, start + LOGIN_WINDOW_MS, LOGIN_WINDOW_MS);
    await clearLimit(key);
    expect((await checkLimit(key, start + LOGIN_WINDOW_MS + 1, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS)).ok).toBe(true);
  });
});
