import { describe, expect, it } from "vitest";
import { settingsOn, withVersionedSettings } from "@/lib/habitSettings";
import { habitDueOn } from "@/lib/recurrence";
import { newItem } from "@/lib/types";

const DAY = "2026-11-18";
const habit = (over: Partial<Parameters<typeof newItem>[0]> = {}) =>
  newItem({ type: "habit", title: "H", rrule: "FREQ=DAILY", active_from: "2026-10-01", difficulty: 3, ...over });

describe("settings changes only apply from today", () => {
  it("keeps the old difficulty and schedule for past days", () => {
    const before = habit({ difficulty: 2 });
    const after = withVersionedSettings(before, { ...before, difficulty: 5, rrule: "FREQ=WEEKLY;BYDAY=MO" }, DAY);
    expect(settingsOn(after, "2026-11-10").difficulty).toBe(2);
    expect(settingsOn(after, DAY).difficulty).toBe(5);
    expect(habitDueOn(after, "2026-11-12")).toBe(true); // a Thursday, under the old daily schedule
    expect(habitDueOn(after, "2026-11-19")).toBe(false); // a Thursday, under the new Monday-only schedule
  });

  it("a habit created today has no history to protect", () => {
    const h = habit({ active_from: DAY });
    expect(withVersionedSettings(h, { ...h, difficulty: 5 }, DAY).versions).toBeUndefined();
  });
});
