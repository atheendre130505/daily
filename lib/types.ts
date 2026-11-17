export type ItemType = "habit" | "event" | "task";
export type TaskStatus = "todo" | "doing" | "done";

/** Earlier settings of a habit, and the last day they applied (see lib/habitSettings.ts). */
export interface HabitVersion {
  until: string;
  rrule: string | null;
  difficulty: number;
  hidden: boolean;
}

export interface Item {
  id: string;
  difficulty?: number; // habits: 1 Easy … 5 Extreme (default 3)
  versions?: HabitVersion[] | null; // habits: settings before the last change
  type: ItemType;
  title: string;
  description: string;
  color: string | null;
  start_at: string | null; // ISO datetime
  end_at: string | null;
  all_day: boolean;
  rrule: string | null; // e.g. "FREQ=WEEKLY;BYDAY=MO,WE,FR" (no DTSTART)
  active_from: string | null; // YYYY-MM-DD
  active_until: string | null;
  hidden: boolean;
  reminder_time: string | null; // "HH:MM" or "HH:MM:SS"
  reminder_minutes: number | null;
  status: TaskStatus | null;
  sort_order: number;
  note_page_id: string | null;
  gcal_calendar_id: string | null;
  gcal_event_id: string | null;
  gcal_etag: string | null;
  updated_at: string;
  deleted_at: string | null;
}

export interface Completion {
  item_id: string;
  date: string; // YYYY-MM-DD
  done: boolean;
  updated_at?: string;
}

export interface Page {
  id: string;
  parent_id: string | null;
  title: string;
  icon: string | null;
  content: unknown[]; // BlockNote blocks
  plain_text: string;
  sort_order: number;
  is_template: boolean;
  daily_date: string | null;
  notion_id: string | null;
  updated_at: string;
  deleted_at: string | null;
}

export type Table = "items" | "completions" | "pages";

export interface Snapshot {
  items: Item[];
  completions: Completion[];
  pages: Page[];
}

export type ChangeEvent =
  | { table: "items"; row: Item }
  | { table: "completions"; row: Completion }
  | { table: "pages"; row: Page };

export function newItem(partial: Partial<Item> & { type: ItemType }): Item {
  return {
    id: crypto.randomUUID(),
    title: "",
    description: "",
    color: null,
    start_at: null,
    end_at: null,
    all_day: false,
    rrule: null,
    active_from: null,
    active_until: null,
    hidden: false,
    reminder_time: null,
    reminder_minutes: null,
    status: null,
    sort_order: Date.now(),
    note_page_id: null,
    gcal_calendar_id: null,
    gcal_event_id: null,
    gcal_etag: null,
    updated_at: new Date().toISOString(),
    deleted_at: null,
    ...partial,
  };
}

export function newPage(partial: Partial<Page> = {}): Page {
  return {
    id: crypto.randomUUID(),
    parent_id: null,
    title: "",
    icon: null,
    content: [],
    plain_text: "",
    sort_order: Date.now(),
    is_template: false,
    daily_date: null,
    notion_id: null,
    updated_at: new Date().toISOString(),
    deleted_at: null,
    ...partial,
  };
}
