import { RRule } from "rrule";
import type { Item } from "./types";
import { fromDateKey, toDateKey } from "./dates";
import { settingsOn } from "./habitSettings";

// rrule works in UTC. We feed it "floating" dates: local wall-clock values stored as UTC,
// so DST and timezones never shift an occurrence to a different day.
function toFloating(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()));
}
function fromFloating(d: Date): Date {
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds());
}

function buildRule(rrule: string, dtstart: Date): RRule {
  const opts = RRule.parseString(rrule.replace(/^RRULE:/, ""));
  return new RRule({ ...opts, dtstart: toFloating(dtstart) });
}

/** Is this habit scheduled (and active) on the given day? Uses the schedule it had on that day. */
export function habitDueOn(item: Item, dateKey: string): boolean {
  if (item.type !== "habit" || item.deleted_at) return false;
  if (item.active_from && dateKey < item.active_from) return false;
  if (item.active_until && dateKey > item.active_until) return false;
  const rrule = settingsOn(item, dateKey).rrule;
  if (!rrule || rrule === "FREQ=DAILY") return true;
  const anchor = fromDateKey(item.active_from ?? "2020-01-01");
  const day = toFloating(fromDateKey(dateKey));
  const rule = buildRule(rrule, anchor);
  return rule.between(day, day, true).length > 0;
}

/** Is the habit active at all on this day (ignores weekday rules)? Used for table columns. */
export function habitActiveOn(item: Item, dateKey: string): boolean {
  if (item.active_from && dateKey < item.active_from) return false;
  if (item.active_until && dateKey > item.active_until) return false;
  return true;
}

export interface Occurrence {
  item: Item;
  start: Date;
  end: Date;
}

/** Expand an event (possibly repeating) into concrete occurrences within [from, to). */
export function eventOccurrences(item: Item, from: Date, to: Date): Occurrence[] {
  if (item.type !== "event" || item.deleted_at || !item.start_at) return [];
  const start = new Date(item.start_at);
  const end = item.end_at ? new Date(item.end_at) : new Date(start.getTime() + 30 * 60_000);
  const duration = end.getTime() - start.getTime();
  if (!item.rrule) {
    return end > from && start < to ? [{ item, start, end }] : [];
  }
  const rule = buildRule(item.rrule, start);
  const hits = rule.between(toFloating(new Date(from.getTime() - duration)), toFloating(to), true);
  return hits.map((h) => {
    const s = fromFloating(h);
    return { item, start: s, end: new Date(s.getTime() + duration) };
  });
}

/** Day key a task is due on, if any. */
export function taskDueKey(item: Item): string | null {
  if (item.type !== "task" || !item.start_at) return null;
  return item.all_day || item.start_at.length === 10 ? item.start_at.slice(0, 10) : toDateKey(new Date(item.start_at));
}

/** Human summary of a habit/event repeat rule. */
export function describeRule(rrule: string | null): string {
  if (!rrule) return "Every day";
  try {
    return RRule.fromString(rrule.replace(/^RRULE:/, "")).toText();
  } catch {
    return rrule;
  }
}

export const WEEKDAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;
