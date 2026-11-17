import type { HabitVersion, Item } from "./types";
import { addDays, todayKey } from "./dates";

export const DIFFICULTY_LABELS = ["", "Easy", "Light", "Medium", "Hard", "Extreme"] as const;
export const DEFAULT_DIFFICULTY = 3;

export interface HabitSettings {
  rrule: string | null;
  difficulty: number;
  hidden: boolean;
}

/**
 * The settings a habit had on a given day. `versions` holds earlier settings with the last day they applied,
 * so changing a habit never rewrites the past.
 */
export function settingsOn(h: Item, dateKey: string): HabitSettings {
  const past = [...(h.versions ?? [])].sort((a, b) => a.until.localeCompare(b.until));
  const v = past.find((x) => dateKey <= x.until);
  if (v) return { rrule: v.rrule, difficulty: v.difficulty, hidden: v.hidden };
  return { rrule: h.rrule, difficulty: h.difficulty ?? DEFAULT_DIFFICULTY, hidden: h.hidden };
}

/**
 * Prepare an edited habit for saving: if a setting that affects scoring changed on a habit that already ran
 * before today, keep the old values for the past (up to yesterday) and apply the new ones from today.
 */
export function withVersionedSettings(prev: Item | undefined, next: Item, today = todayKey()): Item {
  if (!prev || prev.type !== "habit") return next;
  const ranBefore = !prev.active_from || prev.active_from < today;
  const changed =
    (prev.rrule ?? null) !== (next.rrule ?? null) ||
    (prev.difficulty ?? DEFAULT_DIFFICULTY) !== (next.difficulty ?? DEFAULT_DIFFICULTY) ||
    prev.hidden !== next.hidden;
  if (!ranBefore || !changed) return next;
  const yesterday = addDays(today, -1);
  const versions: HabitVersion[] = (prev.versions ?? []).filter((v) => v.until < yesterday);
  versions.push({ until: yesterday, rrule: prev.rrule, difficulty: prev.difficulty ?? DEFAULT_DIFFICULTY, hidden: prev.hidden });
  return { ...next, versions };
}

/** True if the habit was scheduled on any day before today (so deleting it would rewrite history). */
export function hasHistory(h: Item, today = todayKey()): boolean {
  return !!h.active_from && h.active_from < today;
}
