"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, Completion, Item, Page, Snapshot } from "./types";
import { createRepo, type Repo } from "./repo";
import { dayMonthLabel, todayKey } from "./dates";

/** One undoable change: what to show, and the rows that put things back the way they were. */
interface HistoryEntry {
  id: number;
  label: string;
  restore: ChangeEvent[];
}

interface Store extends Snapshot {
  ready: boolean;
  error: string | null;
  mode: Repo["mode"];
  isDone(itemId: string, date: string): boolean;
  toggle(itemId: string, date: string): void;
  saveItem(item: Item, label?: string): void;
  /** Save several items as one change (one Undo puts them all back). */
  saveItems(items: Item[], label: string): void;
  deleteItem(id: string): void;
  /** `record: false` for editor autosaves (the editor has its own Ctrl+Z for text). */
  savePage(page: Page, opts?: { record?: boolean; label?: string }): void;
  deletePage(id: string): void;
  /** Most recent undoable change, or null. */
  lastChange: HistoryEntry | null;
  undo(): void;
}

const Ctx = createContext<Store | null>(null);
const MAX_HISTORY = 50;

const ckey = (itemId: string, date: string) => `${itemId}|${date}`;

function upsertBy<T extends { id: string }>(list: T[], row: T): T[] {
  const i = list.findIndex((x) => x.id === row.id);
  if (i < 0) return [...list, row];
  const next = list.slice();
  next[i] = row;
  return next;
}

/** Short description of an item edit, for the Undo button. */
function describeItemChange(prev: Item | undefined, next: Item): string {
  const name = `"${next.title || "Untitled"}"`;
  if (!prev) return `Added ${name}`;
  if (next.type === "habit" && next.active_until !== prev.active_until) {
    return next.active_until ? `Stopped ${name}` : `Resumed ${name}`;
  }
  if (next.type === "task" && next.status !== prev.status) {
    return next.status === "done" ? `Completed ${name}` : `Reopened ${name}`;
  }
  if (next.start_at !== prev.start_at || next.end_at !== prev.end_at) return `Moved ${name}`;
  return `Edited ${name}`;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const repoRef = useRef<Repo | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [done, setDone] = useState<Map<string, Completion>>(new Map());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const history = useRef<HistoryEntry[]>([]);
  const nextId = useRef(1);
  const [lastChange, setLastChange] = useState<HistoryEntry | null>(null);

  const apply = useCallback((e: ChangeEvent) => {
    if (e.table === "items") {
      setItems((l) => (e.row.deleted_at ? l.filter((x) => x.id !== e.row.id) : upsertBy(l, e.row)));
    } else if (e.table === "pages") {
      setPages((l) => (e.row.deleted_at ? l.filter((x) => x.id !== e.row.id) : upsertBy(l, e.row)));
    } else {
      setDone((m) => new Map(m).set(ckey(e.row.item_id, e.row.date), e.row));
    }
  }, []);

  useEffect(() => {
    const repo = createRepo();
    repoRef.current = repo;
    let off = () => {};
    repo
      .load()
      .then((s) => {
        setItems(s.items);
        setPages(s.pages);
        setDone(new Map(s.completions.map((c) => [ckey(c.item_id, c.date), c])));
        setReady(true);
        off = repo.subscribe(apply);
      })
      .catch((e) => setError(String(e?.message ?? e)));
    return () => off();
  }, [apply]);

  const run = useCallback((p: Promise<void>) => p.catch((e) => setError(String(e?.message ?? e))), []);

  /** Apply a change locally and persist it (no history). */
  const write = useCallback(
    (e: ChangeEvent) => {
      const repo = repoRef.current!;
      const now = new Date().toISOString();
      if (e.table === "items") {
        const row = { ...e.row, updated_at: now };
        apply({ table: "items", row });
        run(repo.saveItem(row));
      } else if (e.table === "pages") {
        const row = { ...e.row, updated_at: now };
        apply({ table: "pages", row });
        run(repo.savePage(row));
      } else {
        apply(e);
        run(repo.saveCompletion(e.row));
      }
    },
    [apply, run],
  );

  const record = useCallback((label: string, restore: ChangeEvent[]) => {
    const entry = { id: nextId.current++, label, restore };
    history.current = [...history.current, entry].slice(-MAX_HISTORY);
    setLastChange(entry);
  }, []);

  const undo = useCallback(() => {
    const entry = history.current.pop();
    if (!entry) return;
    // never reach into a locked day: ticks can only change for today
    const today = todayKey();
    for (const e of entry.restore) if (e.table !== "completions" || e.row.date === today) write(e);
    setLastChange(history.current[history.current.length - 1] ?? null);
  }, [write]);

  const store = useMemo<Store>(() => {
    const nowIso = () => new Date().toISOString();
    return {
      items,
      pages,
      completions: [...done.values()],
      ready,
      error,
      mode: "supabase",
      lastChange,
      undo,
      isDone: (itemId, date) => done.get(ckey(itemId, date))?.done ?? false,
      toggle(itemId, date) {
        if (date !== todayKey()) {
          setError("Only today's habits can be ticked. Past and future days are locked.");
          setTimeout(() => setError(null), 4000);
          return;
        }
        const prev = done.get(ckey(itemId, date)) ?? { item_id: itemId, date, done: false };
        const c: Completion = { item_id: itemId, date, done: !prev.done };
        const name = items.find((i) => i.id === itemId)?.title ?? "habit";
        record(`${c.done ? "Ticked" : "Unticked"} ${name} (${dayMonthLabel(date)})`, [{ table: "completions", row: prev }]);
        write({ table: "completions", row: c });
      },
      saveItem(item, label) {
        const prev = items.find((x) => x.id === item.id);
        record(label ?? describeItemChange(prev, item), [
          { table: "items", row: prev ?? { ...item, deleted_at: nowIso() } }, // new item → undo removes it
        ]);
        write({ table: "items", row: item });
      },
      saveItems(list, label) {
        if (!list.length) return;
        record(
          label,
          list.map((item) => {
            const prev = items.find((x) => x.id === item.id);
            return { table: "items" as const, row: prev ?? { ...item, deleted_at: nowIso() } };
          }),
        );
        for (const item of list) write({ table: "items", row: item });
      },
      deleteItem(id) {
        const it = items.find((x) => x.id === id);
        if (!it) return;
        record(`Deleted "${it.title || "Untitled"}"`, [{ table: "items", row: { ...it, deleted_at: null } }]);
        write({ table: "items", row: { ...it, deleted_at: nowIso() } });
      },
      savePage(page, opts) {
        const prev = pages.find((x) => x.id === page.id);
        if (opts?.record !== false) {
          const name = `"${page.title || "Untitled"}"`;
          const label = opts?.label ?? (!prev ? `Created page ${name}` : prev.title !== page.title ? `Renamed page to ${name}` : `Edited page ${name}`);
          record(label, [{ table: "pages", row: prev ?? { ...page, deleted_at: nowIso() } }]);
        }
        write({ table: "pages", row: page });
      },
      deletePage(id) {
        // soft-delete the page and its descendants; undo brings them all back
        const ids = new Set([id]);
        let grew = true;
        while (grew) {
          grew = false;
          for (const p of pages) if (p.parent_id && ids.has(p.parent_id) && !ids.has(p.id)) (ids.add(p.id), (grew = true));
        }
        const affected = pages.filter((p) => ids.has(p.id));
        const top = pages.find((p) => p.id === id);
        record(
          `Deleted page "${top?.title || "Untitled"}"${affected.length > 1 ? ` and ${affected.length - 1} sub-page(s)` : ""}`,
          affected.map((p) => ({ table: "pages" as const, row: { ...p, deleted_at: null } })),
        );
        const now = nowIso();
        for (const p of affected) write({ table: "pages", row: { ...p, deleted_at: now } });
      },
    };
  }, [items, pages, done, ready, error, lastChange, undo, record, write]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside StoreProvider");
  return s;
}
