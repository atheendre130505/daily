"use client";

import { useEffect, useRef, useState } from "react";
import type { Item, ItemType } from "@/lib/types";
import { newItem } from "@/lib/types";
import { useStore } from "@/lib/store";
import { WEEKDAYS, describeRule } from "@/lib/recurrence";
import { addDays, todayKey } from "@/lib/dates";
import { DEFAULT_DIFFICULTY, DIFFICULTY_LABELS, hasHistory, withVersionedSettings } from "@/lib/habitSettings";

type Repeat = "none" | "daily" | "weekdays" | "weekly" | "custom";

function ruleToRepeat(rrule: string | null): { repeat: Repeat; days: string[] } {
  if (!rrule) return { repeat: "none", days: [] };
  if (rrule === "FREQ=DAILY") return { repeat: "daily", days: [] };
  if (rrule === "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR") return { repeat: "weekdays", days: [] };
  if (rrule === "FREQ=WEEKLY") return { repeat: "weekly", days: [] };
  const m = rrule.match(/^FREQ=WEEKLY;BYDAY=([A-Z,]+)$/);
  if (m) return { repeat: "custom", days: m[1].split(",") };
  return { repeat: "custom", days: [] };
}

function repeatToRule(repeat: Repeat, days: string[]): string | null {
  switch (repeat) {
    case "none":
      return null;
    case "daily":
      return "FREQ=DAILY";
    case "weekdays":
      return "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR";
    case "weekly":
      return "FREQ=WEEKLY";
    case "custom":
      return days.length ? `FREQ=WEEKLY;BYDAY=${WEEKDAYS.filter((d) => days.includes(d)).join(",")}` : "FREQ=DAILY";
  }
}

// <input type="datetime-local"> wants local "YYYY-MM-DDTHH:MM"
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}
function fromLocalInput(v: string): string | null {
  return v ? new Date(v).toISOString() : null;
}

export function ItemEditor({ item, onClose }: { item: Item; onClose: () => void }) {
  const { saveItem, deleteItem, items } = useStore();
  const isNew = !items.some((i) => i.id === item.id);
  const [draft, setDraft] = useState<Item>(item);
  const init = ruleToRepeat(item.rrule);
  const [repeat, setRepeat] = useState<Repeat>(item.type === "habit" && init.repeat === "none" ? "daily" : init.repeat);
  const [days, setDays] = useState<string[]>(init.days);
  const set = (p: Partial<Item>) => setDraft((d) => ({ ...d, ...p }));

  // Focus the title after the opening click/drag has fully finished (a calendar drag's
  // mouseup otherwise steals focus from autoFocus). Escape closes the editor.
  const titleRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const t = setTimeout(() => titleRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const today = todayKey();
  const prev = items.find((i) => i.id === item.id);
  const locked = draft.type === "habit" && !isNew && hasHistory(item, today); // has past days → past is protected
  const save = () => {
    const next = { ...draft, title: draft.title.trim() || "Untitled", rrule: repeatToRule(repeat, days) };
    // schedule / difficulty / hidden changes apply from today; earlier days keep the old settings
    saveItem(draft.type === "habit" ? withVersionedSettings(prev, next, today) : next);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-end md:place-items-center" onClick={onClose}>
      <div
        className="w-full md:max-w-md bg-panel border border-line rounded-t-xl md:rounded-xl p-5 space-y-4 max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex gap-1">
          {(["habit", "event"] as ItemType[]).map((t) => (
            <button
              key={t}
              disabled={!isNew}
              onClick={() => set({ type: t, status: null })}
              className={`px-3 py-1 rounded-md text-sm capitalize ${draft.type === t ? "bg-accent text-bg" : "bg-panel-2 text-muted"} ${!isNew && draft.type !== t ? "hidden" : ""}`}
            >
              {t === "event" ? "Event / meeting" : t}
            </button>
          ))}
        </div>

        <input ref={titleRef} className="input text-lg font-semibold" placeholder="Title" value={draft.title} onChange={(e) => set({ title: e.target.value })} onKeyDown={(e) => e.key === "Enter" && save()} />
        <textarea className="input" rows={2} placeholder="Description (shown as ⓘ)" value={draft.description} onChange={(e) => set({ description: e.target.value })} />

        {draft.type === "event" && (
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="check" checked={draft.all_day} onChange={(e) => set({ all_day: e.target.checked })} /> All day
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Start">
                <input type="datetime-local" className="input" value={toLocalInput(draft.start_at)} onChange={(e) => set({ start_at: fromLocalInput(e.target.value) })} />
              </Field>
              <Field label="End">
                <input type="datetime-local" className="input" value={toLocalInput(draft.end_at)} onChange={(e) => set({ end_at: fromLocalInput(e.target.value) })} />
              </Field>
            </div>
            <Field label="Remind me (minutes before)">
              <input type="number" min={0} className="input" value={draft.reminder_minutes ?? ""} onChange={(e) => set({ reminder_minutes: e.target.value === "" ? null : Number(e.target.value) })} />
            </Field>
          </div>
        )}

        {(
          <Field label="Repeat">
            <select className="input" value={repeat} onChange={(e) => setRepeat(e.target.value as Repeat)}>
              {draft.type === "event" && <option value="none">Does not repeat</option>}
              <option value="daily">Every day</option>
              <option value="weekdays">Weekdays</option>
              <option value="weekly">Every week</option>
              <option value="custom">Specific days…</option>
            </select>
            {repeat === "custom" && (
              <div className="flex gap-1 mt-2">
                {WEEKDAYS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDays((s) => (s.includes(d) ? s.filter((x) => x !== d) : [...s, d]))}
                    className={`w-9 h-8 rounded text-xs ${days.includes(d) ? "bg-accent text-bg" : "bg-panel-2 text-muted"}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}
            {repeat !== "none" && <div className="text-xs text-muted mt-1">{describeRule(repeatToRule(repeat, days))}</div>}
          </Field>
        )}

        {draft.type === "habit" && (
          <div className="space-y-3">
            <Field label="Difficulty (sets how much XP it's worth)">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => set({ difficulty: n })}
                    className={`flex-1 py-1.5 rounded text-xs ${(draft.difficulty ?? DEFAULT_DIFFICULTY) === n ? "bg-accent text-bg font-semibold" : "bg-panel-2 text-muted"}`}
                  >
                    {DIFFICULTY_LABELS[n]}
                  </button>
                ))}
              </div>
            </Field>
            {locked && (
              <p className="text-xs text-muted">
                Changes to repeat, difficulty or hidden apply from today. Earlier days keep their old settings, so past XP doesn&apos;t change.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Field label="Starts">
                <input
                  type="date"
                  className="input disabled:opacity-50"
                  value={draft.active_from ?? ""}
                  min={locked ? undefined : today}
                  disabled={locked}
                  onChange={(e) => set({ active_from: e.target.value && e.target.value >= today ? e.target.value : today })}
                />
              </Field>
              <Field label="Ends (short-term habit)">
                <input
                  type="date"
                  className="input"
                  value={draft.active_until ?? ""}
                  min={addDays(today, -1)}
                  onChange={(e) => set({ active_until: e.target.value ? (e.target.value < addDays(today, -1) ? addDays(today, -1) : e.target.value) : null })}
                />
              </Field>
            </div>
            <div className="flex gap-2">
              {[7, 21, 30, 66].map((n) => (
                <button
                  key={n}
                  className="btn text-xs"
                  onClick={() => {
                    const from = draft.active_from ?? todayKey();
                    set({ active_from: from, active_until: addDays(from, n - 1) });
                  }}
                >
                  {n} days
                </button>
              ))}
            </div>
            <Field label="Daily reminder">
              <input type="time" className="input" value={draft.reminder_time?.slice(0, 5) ?? ""} onChange={(e) => set({ reminder_time: e.target.value || null })} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="check" checked={draft.hidden} onChange={(e) => set({ hidden: e.target.checked })} /> Hidden from the checklist
            </label>
            {!isNew && <StopControls item={{ ...draft, rrule: repeatToRule(repeat, days) }} onDone={onClose} />}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {!isNew && !locked && (
            <button
              className="btn text-danger"
              onClick={() => {
                if (confirm(`Delete "${draft.title}"?`)) {
                  deleteItem(draft.id);
                  onClose();
                }
              }}
            >
              Delete
            </button>
          )}
          <div className="flex-1" />
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs text-muted mb-1">{label}</div>
      {children}
    </label>
  );
}

/** Stop a running habit (its history stays), or restart / un-stop a stopped one. Acts immediately. */
function StopControls({ item, onDone }: { item: Item; onDone: () => void }) {
  const { saveItem, items } = useStore();
  const today = todayKey();
  const yesterday = addDays(today, -1);
  const stopped = !!item.active_until && item.active_until < today;
  const startedBeforeToday = !item.active_from || item.active_from < today;
  const stop = (lastDay: string) => {
    const prev = items.find((i) => i.id === item.id);
    saveItem(withVersionedSettings(prev, { ...item, active_until: lastDay }, today));
    onDone();
  };

  if (stopped) {
    return (
      <div className="rounded-md border border-line p-3 space-y-2">
        <div className="text-sm">Stopped. Last day was {item.active_until}.</div>
        <div className="flex flex-wrap gap-2">
          <button className="btn text-xs" onClick={() => (saveItem(restartHabit(item, today, items), `Restarted "${item.title}"`), onDone())}>
            Start again today (new column)
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-md border border-line p-3 space-y-2">
      <div className="text-sm">Stop this habit</div>
      <div className="text-xs text-muted">Its ticks are kept. From the next day the checklist starts a new table without it. Habits with past days can&apos;t be deleted, so your history stays intact.</div>
      <div className="flex flex-wrap gap-2">
        <button className="btn text-xs" onClick={() => stop(today)}>Stop after today</button>
        {startedBeforeToday && (
          <button className="btn text-xs" onClick={() => stop(yesterday)}>Stop from today (yesterday was the last day)</button>
        )}
      </div>
    </div>
  );
}

/**
 * A fresh run of a stopped habit, starting on `from`: same name, settings and column position, new history.
 * It has no end date; set one in the editor to make it a short-term habit again.
 */
export function restartHabit(h: Item, from: string, all: Item[]): Item {
  const until: string | null = null;
  const siblings = all.filter((x) => x.type === "habit" && x.sort_order > h.sort_order).map((x) => x.sort_order);
  const next = siblings.length ? Math.min(...siblings) : h.sort_order + 1;
  return newItem({
    ...h,
    id: crypto.randomUUID(),
    active_from: from,
    active_until: until,
    sort_order: (h.sort_order + next) / 2,
    gcal_calendar_id: null,
    gcal_event_id: null,
    gcal_etag: null,
    note_page_id: null,
    deleted_at: null,
    versions: null, // a new run starts with a clean settings history
  });
}

export function blankItem(type: Item["type"], partial: Partial<Item> = {}): Item {
  const base: Partial<Item> =
    type === "habit"
      ? { rrule: "FREQ=DAILY", active_from: todayKey(), difficulty: DEFAULT_DIFFICULTY }
      : (() => {
            const s = new Date();
            s.setMinutes(0, 0, 0);
            s.setHours(s.getHours() + 1);
            return { start_at: s.toISOString(), end_at: new Date(s.getTime() + 3600_000).toISOString(), reminder_minutes: 10 };
          })();
  return newItem({ type, ...base, ...partial });
}
