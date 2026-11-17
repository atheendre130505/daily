import { describe, expect, it } from "vitest";
import { computeGame, levelFromXp, xpForLevel, TIERS, weekStart } from "@/lib/game";
import { addDays, dateRange } from "@/lib/dates";
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

describe("daily quest", () => {
  it("starts at level 1 with 60% required", () => {
    const g = run({}, START);
    expect(g.level).toBe(1);
    expect(g.required).toBe(TIERS[0]);
    expect(g.today.due).toBe(5);
  });

  it("clearing days gives XP and builds a streak; today counts once cleared", () => {
    const g = run({ "2026-11-02": 3, "2026-11-03": 5, "2026-11-04": 4 }, "2026-11-04");
    expect(g.history.map((h) => h.cleared)).toEqual([true, true]);
    expect(g.xp).toBeGreaterThan(0);
    expect(g.streak).toBe(3); // two finished days + today already at 80%
    expect(g.today.cleared).toBe(true);
  });

  it("failing loses XP and can drop a level", () => {
    const up = run(Object.fromEntries(dateRange("2026-11-02", "2026-11-04").map((d) => [d, 5])), "2026-11-05");
    expect(up.level).toBeGreaterThanOrEqual(2);
    const down = run({ ...Object.fromEntries(dateRange("2026-11-02", "2026-11-04").map((d) => [d, 5])) }, "2026-11-08");
    expect(down.xp).toBeLessThan(up.xp); // Nov 5–7 missed entirely
    expect(down.level).toBeLessThanOrEqual(up.level);
    expect(down.streak).toBe(0);
  });

  it("XP never goes below zero", () => {
    expect(run({}, "2026-11-20").xp).toBe(0);
  });
});

describe("weekly review", () => {
  it("a strong week raises the required % next week", () => {
    const perfect = Object.fromEntries(dateRange("2026-11-02", "2026-11-08").map((d) => [d, 5]));
    const g = run(perfect, "2026-11-09");
    expect(g.tier).toBe(1);
    expect(g.required).toBe(TIERS[1]);
    expect(g.log.some((l) => l.text.includes("difficulty up"))).toBe(true);
  });

  it("a weak week after a strong one lowers it again", () => {
    const perfect = Object.fromEntries(dateRange("2026-11-02", "2026-11-08").map((d) => [d, 5]));
    const g = run(perfect, "2026-11-16"); // week of Nov 9 had nothing ticked
    expect(g.tier).toBe(0);
  });

  it("met challenges get harder the next week", () => {
    const perfect = Object.fromEntries(dateRange("2026-11-02", "2026-11-08").map((d) => [d, 5]));
    const g = run(perfect, "2026-11-09");
    // week 1 target was ceil(7 * 0.6) = 5; met → 6
    expect(g.challenges.find((c) => c.habitId === "A")!.target).toBe(6);
  });
});

describe("game start", () => {
  it("days before the start date are ignored", () => {
    const g = run({ "2026-11-01": 0 }, "2026-11-02");
    expect(g.history).toHaveLength(0);
    expect(g.xp).toBe(0);
    expect(addDays(START, 0)).toBe(START);
  });
});
