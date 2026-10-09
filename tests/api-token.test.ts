import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as getBotState } from "@/app/api/bot/state/route";
import { isValidApiToken, tokenFromRequest } from "@/lib/api-auth";
import { safeEqual } from "@/lib/safe-equal";
import { useTempStore } from "./helpers";

describe("API token", () => {
  let cleanup: () => void;
  const original = process.env.DASHBOARD_API_TOKEN;

  beforeEach(() => {
    cleanup = useTempStore();
    process.env.DASHBOARD_API_TOKEN = "test-api-token";
  });

  afterEach(() => {
    process.env.DASHBOARD_API_TOKEN = original;
    cleanup();
  });

  it("compares in constant time and rejects missing, wrong, and different-length tokens", () => {
    expect(safeEqual("alpha", "alpha")).toBe(true);
    expect(safeEqual("alpha", "beta")).toBe(false);
    expect(safeEqual("short", "a-much-longer-value")).toBe(false);
    expect(isValidApiToken("test-api-token")).toBe(true);
    expect(isValidApiToken("test-api-token-extra")).toBe(false);
    expect(isValidApiToken("nope")).toBe(false);
    expect(isValidApiToken("")).toBe(false);
    expect(isValidApiToken(null)).toBe(false);
  });

  it("fails closed when the server token is unset", () => {
    delete process.env.DASHBOARD_API_TOKEN;
    expect(isValidApiToken("test-api-token")).toBe(false);
  });

  it("reads only a bearer token and the state route enforces it", async () => {
    const request = new Request("http://localhost/api/bot/state", {
      headers: { authorization: "Bearer test-api-token" },
    });
    expect(tokenFromRequest(request)).toBe("test-api-token");
    expect(tokenFromRequest(new Request("http://localhost/api/bot/state"))).toBeNull();

    const denied = await getBotState(new Request("http://localhost/api/bot/state"));
    expect(denied.status).toBe(401);
    const body = (await denied.json()) as { error: string };
    expect(body.error).toBe("Unauthorized.");
    expect(JSON.stringify(body)).not.toContain("test-api-token");

    const allowed = await getBotState(request);
    expect(allowed.status).toBe(200);
    const state = (await allowed.json()) as { state: { urgent: unknown[] } };
    expect(state.state.urgent).toEqual([]);
  });
});
