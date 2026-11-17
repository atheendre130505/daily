import { describe, expect, it } from "vitest";
import { habitSegments } from "@/lib/segments";
import { dateRange } from "@/lib/dates";
import { newItem } from "@/lib/types";

describe("habitSegments", () => {
  const days = dateRange("2026-11-01", "2026-11-30");
  const exercise = newItem({ type: "habit", title: "Exercise", active_from: "2026-10-26", sort_order: 0 });
  const sugar = newItem({ type: "habit", title: "Sugar", active_from: "2026-10-26", active_until: "2026-11-14", sort_order: 1 });
  const read = newItem({ type: "habit", title: "Read", active_from: "2026-11-15", sort_order: 2 });

  it("one table when nothing changes", () => {
    const s = habitSegments([exercise], days);
    expect(s).toHaveLength(1);
    expect(s[0].from).toBe("2026-11-01");
    expect(s[0].to).toBe("2026-11-30");
  });

  it("stopping one habit and starting another mid-month starts a new table", () => {
    const s = habitSegments([exercise, sugar, read], days);
    expect(s.map((x) => [x.from, x.to])).toEqual([
      ["2026-11-01", "2026-11-14"],
      ["2026-11-15", "2026-11-30"],
    ]);
    expect(s[0].habits.map((h) => h.title)).toEqual(["Exercise", "Sugar"]);
    expect(s[1].habits.map((h) => h.title)).toEqual(["Exercise", "Read"]);
    expect(s[1].started.map((h) => h.title)).toEqual(["Read"]);
    expect(s[1].stopped.map((h) => h.title)).toEqual(["Sugar"]);
    expect(s[0].started).toEqual([]); // first table of the month lists no changes
  });

  it("a short-term habit in the middle makes three tables", () => {
    const sprint = newItem({ type: "habit", title: "No phone", active_from: "2026-11-10", active_until: "2026-11-16", sort_order: 3 });
    const s = habitSegments([exercise, sprint], days);
    expect(s.map((x) => [x.from, x.to, x.habits.length])).toEqual([
      ["2026-11-01", "2026-11-09", 1],
      ["2026-11-10", "2026-11-16", 2],
      ["2026-11-17", "2026-11-30", 1],
    ]);
  });
});
