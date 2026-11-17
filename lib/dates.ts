/** Local-calendar date helpers. Dates are plain "YYYY-MM-DD" strings in the user's timezone. */

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function addDays(key: string, n: number): string {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + n);
  return toDateKey(d);
}

export function dateRange(fromKey: string, toKey: string): string[] {
  const out: string[] = [];
  for (let k = fromKey; k <= toKey; k = addDays(k, 1)) out.push(k);
  return out;
}

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Tue 10" — same label style as the Notion checklist. */
export function shortDayLabel(key: string): string {
  const d = fromDateKey(key);
  return `${WD[d.getDay()]} ${d.getDate()}`;
}

export function monthLabel(key: string): string {
  const d = fromDateKey(key);
  return `${MON[d.getMonth()]} ${d.getFullYear()}`;
}

export function longDayLabel(key: string): string {
  const d = fromDateKey(key);
  return `${WD[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}`;
}

/** "26 Oct" — used where a range can cross months. */
export function dayMonthLabel(key: string): string {
  const d = fromDateKey(key);
  return `${d.getDate()} ${MON[d.getMonth()]}`;
}

export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function userTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
