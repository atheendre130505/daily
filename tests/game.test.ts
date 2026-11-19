import { describe, expect, it } from "vitest";
import { computeGame, levelFromXp, xpForLevel, weekStart } from "@/lib/game";
import { dateRange } from "@/lib/dates";
import { newItem } from "@/lib/types";

const START = "2026-11-02"; // a Monday
const habits = ["A", "B", "C", "D", "E"].map((t, i) =>
  newItem({ id: t, type: "habit", title: t, rrule: "FREQ=DAILY", active_from: "2026-10-01", sort_order: i }),
);

/** Ticks: map of date → how many of the 5 habits were done that day. */
function run(perDay: Record<string, number>, today: string) {
  const done = new Set<string>();
  for (const [d, n] of Object.entries(perDay)) habits.slice(0, n).forEach((h) => done.add(`${h.id}|${d}`));
  return computeGame(habits, (id, d) => done.has(`${id}|${d}`), START, today);
}

describe("levels", () => {
  it("level curve is monotonic and capped at 100", () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(xpForLevel(2) - 1)).toBe(1);
    expect(levelFromXp(xpForLevel(2))).toBe(2);
    expect(levelFromXp(10_000_000)).toBe(100);
  });
  it("week starts on Monday", () => {
    expect(weekStart("2026-11-08")).toBe("2026-11-02"); // Sunday
    expect(weekStart("2026-11-02")).toBe("2026-11-02");
  });
});

describe("XP", () => {
  it("starts at level 1 with nothing earned", () => {
    const g = run({}, START);
    expect(g.level).toBe(1);
    expect(g.xp).toBe(0);
    expect(g.today.due).toBe(5);
  });

  it("each past day nets ticks minus misses, by the same amounts", () => {
    const g = run({ "2026-11-02": 3 }, "2026-11-03");
    const d = g.history[0];
    expect(d.done).toBe(3);
    // all five habits are worth the same on day 1, so 3 done − 2 missed = 1 habit's worth
    expect(d.earned / 3).toBeCloseTo(d.lost / 2);
    expect(d.xp).toBe(d.earned - d.lost);
  });

  it("today's ticks count now, today's misses only once the day is over", () => {
    const g = run({ "2026-11-02": 2 }, "2026-11-02");
    expect(g.xp).toBe(g.today.earnedSoFar);
    expect(g.today.atStake).toBeGreaterThan(0);
  });

  it("missing everything loses XP and can drop levels", () => {
    const perfect = Object.fromEntries(dateRange(START, "2026-11-15").map((d) => [d, 5]));
    const up = run(perfect, "2026-11-16");
    const down = run({ ...perfect, ...Object.fromEntries(dateRange("2026-11-16", "2026-11-22").map((d) => [d, 0])) }, "2026-11-23");
    expect(up.level).toBeGreaterThan(1);
    expect(down.xp).toBeLessThan(up.xp);
  });

  it("a stopped habit stops counting", () => {
    const stopped = habits.map((h) => (h.id === "E" ? { ...h, active_until: "2026-11-02" } : h));
    const g = computeGame(stopped, () => false, START, "2026-11-04");
    expect(g.history[1].due).toBe(4);
  });
});
