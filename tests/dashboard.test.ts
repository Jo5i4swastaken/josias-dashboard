import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { completeItem, createItem, getBotState, getDashboardState, getUiView } from "@/lib/dashboard";
import { createKv } from "@/lib/store";
import { useTempStore } from "./helpers";

describe("dashboard storage", () => {
  let cleanup: () => void;

  beforeEach(() => {
    cleanup = useTempStore();
  });

  afterEach(() => {
    cleanup();
  });

  it("keeps a checked week task done after a fresh read", async () => {
    const created = await createItem("week", { title: "Draft the lab report", day: "thu" }, Date.parse("2026-10-08T15:00:00.000Z"));
    expect(created.done).toBe(false);
    await completeItem("week", created.id, Date.parse("2026-10-08T16:00:00.000Z"));
    const again = await getDashboardState();
    expect(again.week.find((task) => task.id === created.id)?.done).toBe(true);

    const view = await getUiView(Date.parse("2026-10-08T16:00:00.000Z"));
    expect(view.week.some((task) => task.id === created.id && task.done)).toBe(true);
    expect(view.weekStart).toBe("2026-10-05");
  });

  it("sorts deadlines soonest first and returns the full state to the bot", async () => {
    const now = Date.parse("2026-10-08T15:00:00.000Z");
    await createItem("deadlines", { title: "Later essay", dueAt: "2026-10-20" }, now);
    await createItem("deadlines", { title: "Lab", dueAt: "2026-10-09" }, now + 1);
    await createItem("urgent", { title: "Call the supplier" }, now);
    const view = await getUiView(now);
    expect(view.deadlines.map((item) => item.title)).toEqual(["Lab", "Later essay"]);
    const bot = await getBotState(now);
    expect(bot.state.urgent.map((item) => item.title)).toEqual(["Call the supplier"]);
    expect(bot.state.deadlines[0]?.title).toBe("Lab");
  });

  it("refuses the file store in production when Redis is unset", () => {
    expect(() => createKv({ nodeEnv: "production", url: "", token: "", dataDir: "/tmp/josias-nope" })).toThrow(
      /required in production/,
    );
  });
});
