import { describe, expect, it } from "vitest";
import { currentWeekStart } from "@/lib/week";

describe("current week", () => {
  it("starts on Monday for the configured timezone", () => {
    expect(currentWeekStart("UTC", new Date("2026-10-08T15:00:00.000Z"))).toBe("2026-10-05");
    expect(currentWeekStart("Asia/Tokyo", new Date("2026-10-11T20:00:00.000Z"))).toBe("2026-10-12");
  });
});
