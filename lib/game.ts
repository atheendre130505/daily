/**
 * Levelling system. Everything is recomputed from your habits and ticks, day by day from the game's start date,
 * so it can never drift. Past days can't be changed (ticks are locked to today, and habit setting changes only
 * apply from the day they're made), so past XP is stable.
 *
 * XP for ticking a habit on a day (see habitValue):
 *   10 × difficulty × personal hardness × frequency, then × that habit's streak bonus
 *     difficulty        Easy 0.6 · Light 0.8 · Medium 1.0 · Hard 1.35 · Extreme 1.75
 *     personal hardness 0.75 (you always do it) … 1.5 (you rarely do it), from your last 28 scheduled days
 *     frequency         √(7 ÷ times scheduled per week): daily 1.0 · 3×/week 1.53 · weekly 2.65
 *     streak bonus      +4% per consecutive day done, up to +60%
 * A missed habit costs nothing: XP only goes up.
 * Levels 1–100.
 */
import type { Item } from "./types";
import { addDays, dateRange, fromDateKey, toDateKey } from "./dates";
import { habitDueOn } from "./recurrence";
import { settingsOn } from "./habitSettings";

export const MAX_LEVEL = 100;
export const DIFFICULTY_WEIGHT = [0, 0.6, 0.8, 1.0, 1.35, 1.75];

/** XP needed to go from `level` to `level + 1`. */
export function xpToNext(level: number): number {
  return 50 + 15 * level;
}

/** Total XP needed to reach `level` (level 1 = 0 XP). */
export function xpForLevel(level: number): number {
  let total = 0;
  for (let l = 1; l < level; l++) total += xpToNext(l);
  return total;
}

export function levelFromXp(xp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++;
  return level;
}

const RANKS: [number, string][] = [
  [100, "Apex"],
  [90, "Legend"],
  [80, "Grandmaster"],
  [70, "Master"],
  [60, "Elite"],
  [50, "Veteran"],
  [40, "Expert"],
  [30, "Adept"],
  [20, "Apprentice"],
  [10, "Initiate"],
  [1, "Novice"],
];
export function rankFor(level: number): string {
  return RANKS.find(([min]) => level >= min)![1];
}

/** Monday of the week containing `key`. */
export function weekStart(key: string): string {
  const d = fromDateKey(key);
  const dow = (d.getDay() + 6) % 7; // Mon=0
  return addDays(key, -dow);
}

type IsDone = (itemId: string, date: string) => boolean;

export interface HabitValue {
  habitId: string;
  title: string;
  base: number; // value before the streak bonus
  earn: number; // XP for ticking it today, including streak bonus
  miss: number; // XP lost if missed
  difficulty: number;
  hardness: number;
  frequency: number;
  streak: number;
  successRate: number;
}

/** What one habit is worth on one day — see the rules at the top of this file. */
export function habitValue(h: Item, d: string, isDone: IsDone): HabitValue {
  const difficulty = settingsOn(h, d).difficulty;
  // personal hardness: smoothed success rate over the 28 previous scheduled days
  let due = 0;
  let done = 0;
  let streak = 0;
  let streakOpen = true;
  for (let k = 1, cur = addDays(d, -1); k <= 120 && due < 28; k++, cur = addDays(cur, -1)) {
    if (h.active_from && cur < h.active_from) break;
    if (!habitDueOn(h, cur)) continue;
    due++;
    const ok = isDone(h.id, cur);
    if (ok) done++;
    if (streakOpen) {
      if (ok) streak++;
      else streakOpen = false;
    }
  }
  const successRate = (done + 1) / (due + 2);
  const hardness = 0.75 + 0.75 * (1 - successRate);
  // frequency: times scheduled in the week containing d
  const ws = weekStart(d);
  const perWeek = Math.max(1, dateRange(ws, addDays(ws, 6)).filter((x) => habitDueOn(h, x)).length);
  const frequency = Math.min(2.65, Math.sqrt(7 / perWeek));
  const base = 10 * DIFFICULTY_WEIGHT[difficulty] * hardness * frequency;
  const bonus = 1 + 0.04 * Math.min(streak, 15);
  const earn = Math.max(1, Math.round(base * bonus));
  return {
    habitId: h.id,
    title: h.title,
    base: Math.round(base),
    earn,
    miss: 0, // missing costs nothing: XP only goes up
    difficulty,
    hardness,
    frequency,
    streak,
    successRate,
  };
}

export interface DayResult {
  date: string;
  due: number;
  done: number;
  earned: number;
  lost: number;
  xp: number; // net change
}

export interface LogEntry {
  date: string;
  text: string;
  xp: number;
}

export interface GameState {
  startDate: string;
  xp: number;
  level: number;
  rank: string;
  xpIntoLevel: number;
  xpForNext: number; // 0 at max level
  peakLevel: number;
  today: {
    date: string;
    due: number;
    done: number;
    earnedSoFar: number; // XP from habits ticked today (already counted)
    atStake: number; // XP you'll lose for the habits still unticked when the day ends
    habits: (HabitValue & { done: boolean })[];
  };
  log: LogEntry[]; // newest first
  history: DayResult[];
}

/**
 * The whole system: each habit is worth some XP. Tick it → gain that XP. Missing it costs nothing.
 * Stopped, deleted or hidden habits don't count on days they aren't running.
 */
export function computeGame(habitsAll: Item[], isDone: IsDone, startDate: string, today: string): GameState {
  const habits = habitsAll.filter((h) => h.type === "habit" && !h.deleted_at);
  const countedOn = (d: string) => habits.filter((h) => !settingsOn(h, d).hidden && habitDueOn(h, d));
  let xp = 0;
  let peak = 1;
  const log: LogEntry[] = [];
  const history: DayResult[] = [];

  const addXp = (n: number) => {
    xp = Math.max(0, xp + n);
    peak = Math.max(peak, levelFromXp(xp));
  };

  const scoreDay = (d: string) => {
    const values = countedOn(d).map((h) => ({ ...habitValue(h, d, isDone), done: isDone(h.id, d) }));
    const done = values.filter((v) => v.done).length;
    const earned = values.filter((v) => v.done).reduce((s, v) => s + v.earn, 0);
    const lost = values.filter((v) => !v.done).reduce((s, v) => s + v.miss, 0);
    return { values, done, earned, lost };
  };

  const yesterday = addDays(today, -1);
  for (const d of startDate <= yesterday ? dateRange(startDate, yesterday) : []) {
    const s = scoreDay(d);
    if (!s.values.length) continue;
    const net = s.earned - s.lost;
    addXp(net);
    history.push({ date: d, due: s.values.length, done: s.done, earned: s.earned, lost: s.lost, xp: net });
    log.push({ date: d, text: `${s.done}/${s.values.length} habits done`, xp: net });
  }

  const t = today >= startDate ? scoreDay(today) : null;
  if (t) addXp(t.earned);
  const level = levelFromXp(xp);

  return {
    startDate,
    xp,
    level,
    rank: rankFor(level),
    xpIntoLevel: xp - xpForLevel(level),
    xpForNext: level >= MAX_LEVEL ? 0 : xpToNext(level),
    peakLevel: peak,
    today: {
      date: today,
      due: t?.values.length ?? 0,
      done: t?.done ?? 0,
      earnedSoFar: t?.earned ?? 0,
      atStake: t?.lost ?? 0,
      habits: t?.values ?? [],
    },
    log: log.reverse(),
    history,
  };
}

export const keyOf = toDateKey;
