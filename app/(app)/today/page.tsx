"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { addDays, dayMonthLabel, fromDateKey, longDayLabel, timeLabel } from "@/lib/dates";
import { eventOccurrences, habitDueOn } from "@/lib/recurrence";
import { settingsOn } from "@/lib/habitSettings";
import { ItemEditor, blankItem, restartHabit } from "@/components/ItemEditor";
import { StopHabitsDialog } from "@/components/StopHabitsDialog";
import { LateNightNote, NextDayButton } from "@/components/NextDayButton";
import { newPage, type Item } from "@/lib/types";

/** The one page: today's habits to tick, today's events, and the daily note. */
export default function TodayPage() {
  const { items, pages, isDone, toggle, saveItem, savePage, day } = useStore();
  const router = useRouter();
  const [editing, setEditing] = useState<Item | null>(null);
  const [stopping, setStopping] = useState(false);

  const allHabits = items.filter((i) => i.type === "habit");
  const habits = allHabits.filter((i) => !settingsOn(i, day).hidden && habitDueOn(i, day)).sort((a, b) => a.sort_order - b.sort_order);
  const doneCount = habits.filter((h) => isDone(h.id, day)).length;
  const running = new Set(allHabits.filter((h) => !h.active_until || h.active_until >= day).map((h) => h.title.trim().toLowerCase()));
  const stopped = allHabits
    .filter((h) => h.active_until && h.active_until < day && !running.has(h.title.trim().toLowerCase()))
    .sort((a, b) => (b.active_until ?? "").localeCompare(a.active_until ?? ""));

  const events = useMemo(() => {
    const from = fromDateKey(day);
    const to = fromDateKey(addDays(day, 1));
    return items.flatMap((i) => eventOccurrences(i, from, to)).sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [items, day]);

  const openDailyNote = () => {
    const existing = pages.find((p) => p.daily_date === day);
    if (existing) return router.push(`/notes?id=${existing.id}`);
    const p = newPage({ title: longDayLabel(day), icon: null, daily_date: day });
    savePage(p);
    router.push(`/notes?id=${p.id}`);
  };

  return (
    <div className="p-4 md:p-10 max-w-3xl space-y-8">
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold">Today</h1>
          <div className="text-muted text-sm">{longDayLabel(day)}</div>
        </div>
        <NextDayButton />
      </header>
      <LateNightNote />

      <section>
        <div className="flex items-baseline gap-3 mb-2">
          <h2 className="font-semibold flex-1">
            Habits <span className="text-muted font-normal text-sm">{doneCount}/{habits.length}</span>
          </h2>
          {habits.length > 0 && (
            <button className="text-sm text-muted hover:text-text" onClick={() => setStopping(true)}>Stop habits…</button>
          )}
          <button className="text-sm text-muted hover:text-text" onClick={() => setEditing(blankItem("habit"))}>+ Habit</button>
        </div>
        <ul className="divide-y divide-line border-y border-line">
          {habits.map((h) => {
            const done = isDone(h.id, day);
            return (
              <li key={h.id} className="flex items-center gap-3 py-2.5">
                <input type="checkbox" className="check" checked={done} onChange={() => toggle(h.id, day)} aria-label={h.title} />
                <button className="flex-1 text-left" onClick={() => setEditing(h)}>
                  <span className={done ? "text-muted line-through" : ""}>{h.title}</span>
                  {h.description && <span className="block text-xs text-muted">{h.description}</span>}
                </button>
                {h.reminder_time && <span className="text-xs text-muted">at {h.reminder_time.slice(0, 5)}</span>}
              </li>
            );
          })}
          {!habits.length && <li className="py-3 text-muted text-sm">No habits today.</li>}
        </ul>
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="font-semibold">Schedule</h2>
          <button
            className="text-sm text-muted hover:text-text"
            onClick={() => {
              const s = fromDateKey(day);
              s.setHours(new Date().getHours() + 1, 0, 0, 0);
              setEditing(blankItem("event", { start_at: s.toISOString(), end_at: new Date(s.getTime() + 3600_000).toISOString() }));
            }}
          >
            + Event
          </button>
        </div>
        <ul className="space-y-2">
          {events.map((o) => (
            <li key={o.item.id + o.start.toISOString()}>
              <button className="w-full flex gap-3 items-stretch text-left rounded-md bg-panel hover:bg-panel-2 p-2.5" onClick={() => setEditing(o.item)}>
                <span className="w-1 rounded bg-line" />
                <span className="text-sm text-muted w-28 shrink-0">
                  {o.item.all_day ? "All day" : `${timeLabel(o.start.toISOString())} – ${timeLabel(o.end.toISOString())}`}
                </span>
                <span className="flex-1">{o.item.title}</span>
              </button>
            </li>
          ))}
          {!events.length && <li className="text-muted text-sm">Nothing scheduled.</li>}
        </ul>
      </section>

      <section className="flex gap-2">
        <button className="btn" onClick={openDailyNote}>Daily note</button>
      </section>

      {stopped.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted">Stopped habits ({stopped.length})</summary>
          <ul className="divide-y divide-line border-y border-line mt-2">
            {stopped.map((h) => (
              <li key={h.id} className="flex items-center gap-3 py-2">
                <button className="hover:underline" onClick={() => setEditing(h)}>{h.title}</button>
                <span className="text-muted flex-1">stopped {dayMonthLabel(h.active_until!)}</span>
                <button className="btn text-xs" onClick={() => saveItem(restartHabit(h, day, allHabits), `Restarted "${h.title}"`)}>Start again</button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {editing && <ItemEditor item={editing} onClose={() => setEditing(null)} />}
      {stopping && <StopHabitsDialog onClose={() => setStopping(false)} />}
    </div>
  );
}
