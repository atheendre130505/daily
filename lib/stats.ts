import type { Item } from "./types";
import { addDays, todayKey } from "./dates";
import { habitDueOn } from "./recurrence";

/** Consecutive scheduled days ticked, ending today (or yesterday if today isn't ticked yet). */
export function currentStreak(item: Item, isDone: (id: string, d: string) => boolean, today = todayKey()): number {
  let day = isDone(item.id, today) ? today : addDays(today, -1);
  let n = 0;
  for (let guard = 0; guard < 3650; guard++) {
    if (item.active_from && day < item.active_from) break;
    if (habitDueOn(item, day)) {
      if (!isDone(item.id, day)) break;
      n++;
    }
    day = addDays(day, -1);
  }
  return n;
}

/** Share of scheduled days in [from, to] that were ticked (days after today are ignored). */
export function completionRate(item: Item, isDone: (id: string, d: string) => boolean, from: string, to: string): number | null {
  const end = to < todayKey() ? to : todayKey();
  let due = 0;
  let hit = 0;
  for (let d = from; d <= end; d = addDays(d, 1)) {
    if (habitDueOn(item, d)) {
      due++;
      if (isDone(item.id, d)) hit++;
    }
  }
  return due ? hit / due : null;
}
