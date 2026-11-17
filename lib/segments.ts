import type { Item } from "./types";
import { habitActiveOn } from "./recurrence";

export interface Segment {
  from: string; // first day (YYYY-MM-DD)
  to: string; // last day
  days: string[];
  habits: Item[]; // habits active throughout this stretch, in display order
  started: Item[]; // habits that begin at the start of this stretch
  stopped: Item[]; // habits that ended just before this stretch
}

/**
 * Splits a list of days into consecutive stretches where the same set of habits is active.
 * Starting or stopping a habit mid-month therefore starts a new table.
 */
export function habitSegments(habits: Item[], days: string[]): Segment[] {
  const ordered = [...habits].sort((a, b) => a.sort_order - b.sort_order);
  const out: Segment[] = [];
  let prev: Item[] | null = null;
  for (const d of days) {
    const active = ordered.filter((h) => habitActiveOn(h, d));
    const key = active.map((h) => h.id).join(",");
    const last = out[out.length - 1];
    if (last && last.habits.map((h) => h.id).join(",") === key) {
      last.to = d;
      last.days.push(d);
    } else {
      const before = new Set((prev ?? []).map((h) => h.id));
      const now = new Set(active.map((h) => h.id));
      out.push({
        from: d,
        to: d,
        days: [d],
        habits: active,
        started: prev ? active.filter((h) => !before.has(h.id)) : [],
        stopped: prev ? prev.filter((h) => !now.has(h.id)) : [],
      });
    }
    prev = active;
  }
  return out;
}
