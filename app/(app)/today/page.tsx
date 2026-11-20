"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GameSummary } from "@/components/GameSummary";
import { useStore } from "@/lib/store";
import { useGame } from "@/lib/useGame";
import { addDays, fromDateKey, longDayLabel, timeLabel } from "@/lib/dates";
import { eventOccurrences, habitDueOn } from "@/lib/recurrence";
import { DIFFICULTY_LABELS, settingsOn } from "@/lib/habitSettings";
import { currentStreak } from "@/lib/stats";
import { ItemEditor, blankItem } from "@/components/ItemEditor";
import { LateNightNote, NextDayButton } from "@/components/NextDayButton";
import { newPage, type Item } from "@/lib/types";

export default function TodayPage() {
  const { items, pages, isDone, toggle, savePage, day: today } = useStore();
  const { game } = useGame();
  const router = useRouter();
  const [viewDay, setDay] = useState<string | null>(null);
  const [editing, setEditing] = useState<Item | null>(null);
  const day = viewDay ?? today;
  const isToday = day === today;

  const habits = items
    .filter((i) => i.type === "habit" && !settingsOn(i, day).hidden && habitDueOn(i, day))
    .sort((a, b) => a.sort_order - b.sort_order);
  const doneCount = habits.filter((h) => isDone(h.id, day)).length;
  const values = new Map((game?.today.habits ?? []).map((v) => [v.habitId, v]));

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
      <header className="flex items-center gap-2">
        {/* past days aren't shown */}
        <button className="btn disabled:opacity-30" disabled={day <= today} onClick={() => setDay(addDays(day, -1))}>‹</button>
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold">{isToday ? "Today" : longDayLabel(day)}</h1>
          <div className="text-muted text-sm">{isToday ? longDayLabel(day) : "Upcoming · view only"}</div>
        </div>
        {!isToday && <button className="btn" onClick={() => setDay(null)}>Today</button>}
        <button className="btn" onClick={() => setDay(addDays(day, 1))}>›</button>
      </header>

      {isToday && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-0"><LateNightNote /></div>
          <NextDayButton />
        </div>
      )}

      {isToday && <GameSummary game={game} />}

      <section>
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="font-semibold">
            Habits <span className="text-muted font-normal text-sm">{doneCount}/{habits.length}</span>
          </h2>
          <button className="text-sm text-muted hover:text-text" onClick={() => setEditing(blankItem("habit"))}>+ Habit</button>
        </div>
        <ul className="divide-y divide-line border-y border-line">
          {habits.map((h) => {
            const v = isToday ? values.get(h.id) : undefined;
            const done = isDone(h.id, day);
            return (
              <li key={h.id} className="flex items-center gap-3 py-2.5">
                <input
                  type="checkbox"
                  className="check disabled:opacity-40 disabled:cursor-not-allowed"
                  checked={done}
                  disabled={!isToday}
                  title={isToday ? undefined : "Only today can be ticked"}
                  onChange={() => toggle(h.id, day)}
                />
                <button className="flex-1 text-left" onClick={() => setEditing(h)}>
                  <span className={done ? "text-muted line-through" : ""}>{h.title}</span>
                  {h.description && <span className="block text-xs text-muted">{h.description}</span>}
                </button>
                {h.reminder_time && <span className="text-xs text-muted">at {h.reminder_time.slice(0, 5)}</span>}
                <span className="text-xs text-muted w-14 text-right">{DIFFICULTY_LABELS[settingsOn(h, day).difficulty]}</span>
                {v && (
                  <span className="text-xs w-16 text-right tabular-nums" title={`Tick it: +${v.earn} XP`}>
                    {done ? `+${v.earn} XP` : <span className="text-muted">+{v.earn} XP</span>}
                  </span>
                )}
                <span className="text-xs text-muted w-16 text-right">streak {currentStreak(h, isDone, today)}</span>
              </li>
            );
          })}
          {!habits.length && <li className="py-3 text-muted text-sm">No habits scheduled.</li>}
        </ul>
        {!isToday && <p className="text-xs text-muted mt-2">Only today&apos;s habits can be ticked.</p>}
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="font-semibold">Schedule</h2>
          <button
            className="text-sm text-muted hover:text-text"
            onClick={() => {
              const s = fromDateKey(day);
              const now = new Date();
              s.setHours(isToday ? now.getHours() + 1 : 9, 0, 0, 0);
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

      {editing && <ItemEditor item={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
