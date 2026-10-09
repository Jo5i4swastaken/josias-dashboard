import { describe, expect, it } from "vitest";
import { PENDING_TTL_SECONDS, SESSION_TTL_SECONDS } from "@/lib/constants";
import { sessionOptions } from "@/lib/session-options";

describe("session cookies", () => {
  it("uses an encrypted httpOnly cookie that lasts about 7 days", () => {
    const options = sessionOptions("session");
    expect(options.ttl).toBe(SESSION_TTL_SECONDS);
    expect(SESSION_TTL_SECONDS).toBe(60 * 60 * 24 * 7);
    expect(options.cookieOptions?.httpOnly).toBe(true);
    expect(options.cookieOptions?.sameSite).toBe("lax");
    expect(options.cookieOptions?.secure).toBe(false);
    expect(options.password.toString().length).toBeGreaterThanOrEqual(32);

    const pending = sessionOptions("pending");
    expect(pending.ttl).toBe(PENDING_TTL_SECONDS);
    expect(pending.cookieName).not.toBe(options.cookieName);
  });
});
