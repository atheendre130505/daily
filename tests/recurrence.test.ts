import { describe, expect, it } from "vitest";
import { eventOccurrences, habitDueOn } from "@/lib/recurrence";
import { currentStreak } from "@/lib/stats";
import { newItem } from "@/lib/types";

describe("habitDueOn", () => {
  it("daily habit respects start and end (short-term habit)", () => {
    const h = newItem({ type: "habit", rrule: "FREQ=DAILY", active_from: "2026-11-11", active_until: "2026-11-20" });
    expect(habitDueOn(h, "2026-11-10")).toBe(false);
    expect(habitDueOn(h, "2026-11-11")).toBe(true);
    expect(habitDueOn(h, "2026-11-20")).toBe(true);
    expect(habitDueOn(h, "2026-11-21")).toBe(false);
  });

  it("weekday rule only on chosen days", () => {
    const h = newItem({ type: "habit", rrule: "FREQ=WEEKLY;BYDAY=MO,WE,FR", active_from: "2026-11-01" });
    expect(habitDueOn(h, "2026-11-16")).toBe(true); // Monday
    expect(habitDueOn(h, "2026-11-17")).toBe(false); // Tuesday
    expect(habitDueOn(h, "2026-11-18")).toBe(true); // Wednesday
  });
});

describe("eventOccurrences", () => {
  it("expands a weekly meeting at the same wall-clock time", () => {
    const start = new Date(2026, 10, 2, 10, 0); // Mon 2 Nov 10:00 local
    const ev = newItem({ type: "event", start_at: start.toISOString(), end_at: new Date(2026, 10, 2, 10, 30).toISOString(), rrule: "FREQ=WEEKLY" });
    const occ = eventOccurrences(ev, new Date(2026, 10, 1), new Date(2026, 10, 30));
    expect(occ).toHaveLength(4);
    expect(occ.every((o) => o.start.getHours() === 10 && o.start.getDay() === 1)).toBe(true);
    expect(occ[0].end.getTime() - occ[0].start.getTime()).toBe(30 * 60_000);
  });

  it("single event outside range is excluded", () => {
    const ev = newItem({ type: "event", start_at: new Date(2026, 0, 1, 9).toISOString(), end_at: new Date(2026, 0, 1, 10).toISOString() });
    expect(eventOccurrences(ev, new Date(2026, 1, 1), new Date(2026, 2, 1))).toHaveLength(0);
  });
});

describe("currentStreak", () => {
  it("counts back from yesterday when today is not ticked yet", () => {
    const h = newItem({ type: "habit", rrule: "FREQ=DAILY", active_from: "2026-11-01" });
    const ticked = new Set(["2026-11-14", "2026-11-15", "2026-11-16"]);
    expect(currentStreak(h, (_id, d) => ticked.has(d), "2026-11-17")).toBe(3);
    ticked.add("2026-11-17");
    expect(currentStreak(h, (_id, d) => ticked.has(d), "2026-11-17")).toBe(4);
  });
});
