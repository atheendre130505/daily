import { describe, expect, it } from "vitest";
import { computeGame, habitValue } from "@/lib/game";
import { settingsOn, withVersionedSettings } from "@/lib/habitSettings";
import { habitDueOn } from "@/lib/recurrence";
import { dateRange } from "@/lib/dates";
import { newItem } from "@/lib/types";

const DAY = "2026-11-18";
const habit = (over: Partial<Parameters<typeof newItem>[0]> = {}) =>
  newItem({ type: "habit", title: "H", rrule: "FREQ=DAILY", active_from: "2026-10-01", difficulty: 3, ...over });
const ticks = (id: string, days: string[]) => {
  const s = new Set(days.map((d) => `${id}|${d}`));
  return (i: string, d: string) => s.has(`${i}|${d}`);
};
const none = () => false;

describe("habit XP", () => {
  it("harder difficulty is worth more", () => {
    const easy = habitValue(habit({ difficulty: 1 }), DAY, none);
    const extreme = habitValue(habit({ difficulty: 5 }), DAY, none);
    expect(extreme.base).toBeGreaterThan(easy.base * 2.5);
  });

  it("a habit you rarely manage is worth more than one you always do", () => {
    const h = habit();
    const always = habitValue(h, DAY, ticks(h.id, dateRange("2026-10-21", "2026-11-17")));
    const rarely = habitValue(h, DAY, ticks(h.id, ["2026-11-01"]));
    expect(rarely.hardness).toBeGreaterThan(always.hardness);
    expect(rarely.base).toBeGreaterThan(always.base);
  });

  it("a 3×/week habit is worth more per tick than a daily one", () => {
    const daily = habitValue(habit(), DAY, none);
    const thrice = habitValue(habit({ rrule: "FREQ=WEEKLY;BYDAY=MO,WE,FR" }), DAY, none);
    expect(thrice.frequency).toBeCloseTo(Math.sqrt(7 / 3), 5);
    expect(thrice.base).toBeGreaterThan(daily.base);
  });

  it("a streak raises what a tick earns", () => {
    const h = habit();
    const fresh = habitValue(h, DAY, none);
    const onStreak = habitValue(h, DAY, ticks(h.id, dateRange("2026-11-08", "2026-11-17")));
    expect(onStreak.streak).toBe(10);
    expect(onStreak.earn / onStreak.base).toBeGreaterThan(1.35);
    expect(fresh.earn).toBe(fresh.base);
  });

  it("missing costs nothing", () => {
    const v = habitValue(habit({ difficulty: 4 }), DAY, none);
    expect(v.miss).toBe(0);
  });
});

describe("settings changes only apply from today", () => {
  it("keeps the old difficulty and schedule for past days", () => {
    const before = habit({ difficulty: 2 });
    const after = withVersionedSettings(before, { ...before, difficulty: 5, rrule: "FREQ=WEEKLY;BYDAY=MO" }, DAY);
    expect(settingsOn(after, "2026-11-10").difficulty).toBe(2);
    expect(settingsOn(after, DAY).difficulty).toBe(5);
    expect(habitDueOn(after, "2026-11-12")).toBe(true); // a Thursday, under the old daily schedule
    expect(habitDueOn(after, "2026-11-19")).toBe(false); // a Thursday, under the new Monday-only schedule
  });

  it("past XP doesn't change when a habit is edited today", () => {
    const h = habit({ difficulty: 2 });
    const done = ticks(h.id, dateRange("2026-11-02", "2026-11-17"));
    const g1 = computeGame([h], done, "2026-11-02", DAY);
    const g2 = computeGame([withVersionedSettings(h, { ...h, difficulty: 5 }, DAY)], done, "2026-11-02", DAY);
    expect(g2.xp).toBe(g1.xp);
    expect(g2.today.habits[0].difficulty).toBe(5);
  });

  it("a habit created today has no history to protect", () => {
    const h = habit({ active_from: DAY });
    expect(withVersionedSettings(h, { ...h, difficulty: 5 }, DAY).versions).toBeUndefined();
  });
});
