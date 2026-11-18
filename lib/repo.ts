import type { ChangeEvent, Completion, Item, Page, Snapshot } from "./types";
import { supabaseBrowser, supabaseConfigured } from "./supabase/client";

/** Storage backend used by the UI: your Supabase project (data, sign-in, live sync between devices). */
export interface Repo {
  mode: "supabase";
  load(): Promise<Snapshot & { settings?: { gameStart?: string } }>;
  saveItem(item: Item): Promise<void>;
  saveCompletion(c: Completion): Promise<void>;
  savePage(page: Page): Promise<void>;
  subscribe(onChange: (e: ChangeEvent) => void): () => void;
  /** The day you're on (null if never set, or the database isn't updated yet). */
  loadDay(): Promise<string | null>;
  saveDay(day: string): Promise<void>;
  onDayChange(cb: (day: string | null) => void): () => void;
}

// ---------- Supabase ----------

function supabaseRepo(): Repo {
  const sb = supabaseBrowser();
  const tables = ["items", "completions", "pages"] as const;
  return {
    mode: "supabase",
    async load() {
      const [items, completions, pages] = await Promise.all([
        sb.from("items").select("*").is("deleted_at", null),
        sb.from("completions").select("item_id,date,done,updated_at"),
        sb.from("pages").select("id,parent_id,title,icon,content,plain_text,sort_order,is_template,daily_date,notion_id,updated_at,deleted_at").is("deleted_at", null),
      ]);
      for (const r of [items, completions, pages]) if (r.error) throw r.error;
      return { items: items.data as Item[], completions: completions.data as Completion[], pages: pages.data as Page[] };
    },
    async saveItem(item) {
      const row = { ...item } as Record<string, unknown>;
      delete row.updated_at;
      const { error } = await sb.from("items").upsert(row);
      if (error) throw error;
    },
    async saveCompletion(c) {
      const { error } = await sb.from("completions").upsert({ item_id: c.item_id, date: c.date, done: c.done });
      if (error) throw error;
    },
    async savePage(page) {
      const row = { ...page } as Record<string, unknown>;
      delete row.updated_at;
      const { error } = await sb.from("pages").upsert(row);
      if (error) throw error;
    },
    subscribe(onChange) {
      const ch = sb.channel("db");
      for (const table of tables) {
        ch.on("postgres_changes", { event: "*", schema: "public", table }, (payload) => {
          const row = (payload.new && Object.keys(payload.new).length ? payload.new : payload.old) as never;
          onChange({ table, row } as ChangeEvent);
        });
      }
      ch.subscribe();
      return () => {
        sb.removeChannel(ch);
      };
    },
    async loadDay() {
      const { data, error } = await sb.from("user_settings").select("current_day").maybeSingle();
      if (error) return null;
      return (data?.current_day as string | null) ?? null;
    },
    async saveDay(day) {
      const { error } = await sb.from("user_settings").upsert({ current_day: day });
      if (error) throw error;
    },
    onDayChange(cb) {
      const ch = sb.channel("my-day");
      ch.on("postgres_changes", { event: "*", schema: "public", table: "user_settings" }, (payload) => {
        const row = payload.new as { current_day?: string | null } | null;
        if (row && "current_day" in row) cb(row.current_day ?? null);
      });
      ch.subscribe();
      return () => {
        sb.removeChannel(ch);
      };
    },
  };
}

export function createRepo(): Repo {
  return supabaseRepo();
}
