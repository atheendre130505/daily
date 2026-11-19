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
 * A missed habit costs exactly what ticking it would have earned that day.
 *
 * Daily quest: tick at least the required % of the day's habits.
 *   cleared → quest bonus (10 + 5 per difficulty step, +10 for a perfect day, boosted by your clear streak)
 *   failed  → an extra penalty of 10 + 5 per difficulty step
 * Weekly review (Mondays): clear ≥70% of quest days → required % rises (60→70→80→90→100) +150 XP;
 *   <40% → it drops, −100 XP. Weekly challenges per habit: meet the target → +25 XP and the target rises by one;
 *   miss → −15 XP. Levels 1–100; losing XP can drop a level; XP never goes below 0.
 */
import type { Item } from "./types";
import { addDays, dateRange, fromDateKey, toDateKey } from "./dates";
import { habitDueOn } from "./recurrence";
import { settingsOn } from "./habitSettings";

export const TIERS = [0.6, 0.7, 0.8, 0.9, 1.0];
export const MAX_LEVEL = 100;
export const DIFFICULTY_WEIGHT = [0, 0.6, 0.8, 1.0, 1.35, 1.75];
const PROMOTE_AT = 0.7;
const DEMOTE_BELOW = 0.4;

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
    miss: earn, // missing costs the same as ticking earns
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
  pct: number;
  required: number;
  cleared: boolean;
  xp: number; // net change
}

export interface Challenge {
  habitId: string;
  title: string;
  target: number;
  done: number;
  dueDays: number;
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
  tier: number;
  required: number;
  streak: number;
  today: {
    date: string;
    due: number;
    done: number;
    pct: number;
    required: number;
    cleared: boolean;
    earnedSoFar: number; // XP from habits ticked today
    xpIfCleared: number; // projected net for today if it stays cleared (or once it is)
    xpIfFailedNow: number; // projected net if the day ended now
    habits: (HabitValue & { done: boolean })[];
  };
  week: { start: string; end: string; questDays: number; cleared: number; daysLeft: number; promoteNeeds: number; demoteBelow: number };
  challenges: Challenge[];
  log: LogEntry[]; // newest first
  history: DayResult[];
}

function questBonus(tier: number, perfect: boolean, streak: number): number {
  return Math.round((10 + 5 * tier + (perfect ? 10 : 0)) * (1 + 0.05 * Math.min(streak, 10)));
}
const failPenalty = (tier: number) => 10 + 5 * tier;

export function computeGame(habitsAll: Item[], isDone: IsDone, startDate: string, today: string): GameState {
  const habits = habitsAll.filter((h) => h.type === "habit" && !h.deleted_at);
  const countedOn = (d: string) => habits.filter((h) => !settingsOn(h, d).hidden && habitDueOn(h, d));
  let xp = 0;
  let peak = 1;
  let tier = 0;
  let streak = 0;
  const log: LogEntry[] = [];
  const history: DayResult[] = [];
  const targets = new Map<string, number>();

  const addXp = (n: number) => {
    xp = Math.max(0, xp + n);
    peak = Math.max(peak, levelFromXp(xp));
  };

  const challengesFor = (wStart: string, upTo: string): Challenge[] => {
    const days = dateRange(wStart < startDate ? startDate : wStart, addDays(wStart, 6));
    return habits
      .map((h) => {
        const dueDays = days.filter((d) => countedOn(d).includes(h)).length;
        if (!dueDays) return null;
        const target = Math.min(dueDays, targets.get(h.id) ?? Math.max(1, Math.ceil(dueDays * 0.6)));
        const done = days.filter((d) => d <= upTo && countedOn(d).includes(h) && isDone(h.id, d)).length;
        return { habitId: h.id, title: h.title, target, done, dueDays };
      })
      .filter((c): c is Challenge => !!c);
  };

  function review(ws: string, days: DayResult[]) {
    const weekEnd = addDays(ws, 6);
    for (const c of challengesFor(ws, weekEnd)) {
      if (c.done >= c.target) {
        addXp(25);
        const next = Math.min(7, c.target + 1);
        targets.set(c.habitId, next);
        log.push({ date: weekEnd, text: `Challenge met: ${c.title} ${c.done}/${c.target} · next week's target ${next}`, xp: 25 });
      } else {
        addXp(-15);
        targets.set(c.habitId, c.done <= c.target - 3 ? Math.max(1, c.target - 1) : c.target);
        log.push({ date: weekEnd, text: `Challenge missed: ${c.title} ${c.done}/${c.target}`, xp: -15 });
      }
    }
    if (!days.length) return;
    const rate = days.filter((r) => r.cleared).length / days.length;
    if (rate >= PROMOTE_AT && tier < TIERS.length - 1) {
      tier++;
      addXp(150);
      log.push({ date: weekEnd, text: `Week cleared ${Math.round(rate * 100)}% → difficulty up: daily quest now needs ${Math.round(TIERS[tier] * 100)}%`, xp: 150 });
    } else if (rate >= PROMOTE_AT) {
      addXp(200);
      log.push({ date: weekEnd, text: `Week cleared ${Math.round(rate * 100)}% at top difficulty`, xp: 200 });
    } else if (rate < DEMOTE_BELOW) {
      const before = tier;
      tier = Math.max(0, tier - 1);
      addXp(-100);
      log.push({ date: weekEnd, text: `Week cleared only ${Math.round(rate * 100)}%${before !== tier ? ` → difficulty down to ${Math.round(TIERS[tier] * 100)}%` : ""}`, xp: -100 });
    } else {
      log.push({ date: weekEnd, text: `Week cleared ${Math.round(rate * 100)}% · difficulty stays at ${Math.round(TIERS[tier] * 100)}%`, xp: 0 });
    }
  }

  /** Score one day: XP for ticks, penalties for misses, quest bonus or penalty. */
  const scoreDay = (d: string, curTier: number, curStreak: number) => {
    const due = countedOn(d);
    const values = due.map((h) => ({ ...habitValue(h, d, isDone), done: isDone(h.id, d) }));
    const done = values.filter((v) => v.done).length;
    const pct = due.length ? done / due.length : 0;
    const required = TIERS[curTier];
    const cleared = due.length > 0 && pct >= required - 1e-9;
    const earned = values.filter((v) => v.done).reduce((s, v) => s + v.earn, 0);
    const missed = values.filter((v) => !v.done).reduce((s, v) => s + v.miss, 0);
    const net = cleared ? earned - missed + questBonus(curTier, pct >= 1, curStreak) : earned - missed - failPenalty(curTier);
    return { due, values, done, pct, required, cleared, earned, missed, net };
  };

  const yesterday = addDays(today, -1);
  let wStart = weekStart(startDate);
  let weekDays: DayResult[] = [];
  for (const d of startDate <= yesterday ? dateRange(startDate, yesterday) : []) {
    if (weekStart(d) !== wStart) {
      review(wStart, weekDays);
      wStart = weekStart(d);
      weekDays = [];
    }
    const s = scoreDay(d, tier, streak);
    if (!s.due.length) continue;
    streak = s.cleared ? streak + 1 : 0;
    addXp(s.net);
    const r: DayResult = { date: d, due: s.due.length, done: s.done, pct: s.pct, required: s.required, cleared: s.cleared, xp: s.net };
    history.push(r);
    weekDays.push(r);
    log.push({
      date: d,
      text: `${s.cleared ? "Quest cleared" : "Quest failed"} · ${s.done}/${s.due.length} (${Math.round(s.pct * 100)}%, needed ${Math.round(s.required * 100)}%) · habits +${s.earned} −${s.missed}`,
      xp: s.net,
    });
  }
  if (weekStart(today) !== wStart) {
    review(wStart, weekDays);
    wStart = weekStart(today);
    weekDays = [];
  }

  // Today: live projection
  const t = today >= startDate ? scoreDay(today, tier, streak) : null;
  const required = TIERS[tier];
  const clearedToday = !!t?.cleared;
  // if not cleared yet: what clearing would be worth assuming the cheapest extra habits get ticked
  let xpIfCleared = t?.net ?? 0;
  if (t && !t.cleared && t.due.length) {
    const need = Math.ceil(required * t.due.length - 1e-9) - t.done;
    const extra = t.values.filter((v) => !v.done).sort((a, b) => a.earn - b.earn).slice(0, need);
    const earned = t.earned + extra.reduce((s, v) => s + v.earn, 0);
    const missed = t.missed - extra.reduce((s, v) => s + v.miss, 0);
    xpIfCleared = earned - missed + questBonus(tier, t.done + need >= t.due.length, streak);
  }

  const weekEnd = addDays(wStart, 6);
  const questDays = dateRange(wStart < startDate ? startDate : wStart, weekEnd).filter((d) => countedOn(d).length > 0).length;
  const clearedThisWeek = weekDays.filter((r) => r.cleared).length + (clearedToday ? 1 : 0);
  const daysLeft = dateRange(today, weekEnd).filter((d) => countedOn(d).length > 0).length - (clearedToday ? 1 : 0);
  const level = levelFromXp(xp);

  return {
    startDate,
    xp,
    level,
    rank: rankFor(level),
    xpIntoLevel: xp - xpForLevel(level),
    xpForNext: level >= MAX_LEVEL ? 0 : xpToNext(level),
    peakLevel: peak,
    tier,
    required,
    streak: streak + (clearedToday ? 1 : 0),
    today: {
      date: today,
      due: t?.due.length ?? 0,
      done: t?.done ?? 0,
      pct: t?.pct ?? 0,
      required,
      cleared: clearedToday,
      earnedSoFar: t?.earned ?? 0,
      xpIfCleared,
      xpIfFailedNow: t ? (t.cleared ? t.net : t.net) : 0,
      habits: t?.values ?? [],
    },
    week: {
      start: wStart,
      end: weekEnd,
      questDays,
      cleared: clearedThisWeek,
      daysLeft: Math.max(0, daysLeft),
      promoteNeeds: Math.ceil(questDays * PROMOTE_AT),
      demoteBelow: Math.ceil(questDays * DEMOTE_BELOW),
    },
    challenges: challengesFor(wStart, today),
    log: log.reverse(),
    history,
  };
}

export const keyOf = toDateKey;
