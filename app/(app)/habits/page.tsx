"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { addDays, dateRange, dayMonthLabel, fromDateKey, longDayLabel, shortDayLabel } from "@/lib/dates";
import { habitDueOn } from "@/lib/recurrence";
import { settingsOn } from "@/lib/habitSettings";
import { ItemEditor, blankItem, restartHabit } from "@/components/ItemEditor";
import { StopHabitsDialog } from "@/components/StopHabitsDialog";
import { LateNightNote, NextDayButton } from "@/components/NextDayButton";
import type { Item } from "@/lib/types";

const mondayOf = (key: string) => addDays(key, -((fromDateKey(key).getDay() + 6) % 7));

/** The one page: the week's habit table. Tick today's boxes; earlier weeks are view only. */
export default function HabitsPage() {
  const { items, isDone, saveItem, day } = useStore();
  const [editing, setEditing] = useState<Item | null>(null);
  const [stopping, setStopping] = useState(false);

  const allHabits = items.filter((i) => i.type === "habit");
  const habits = allHabits.filter((i) => !settingsOn(i, day).hidden && habitDueOn(i, day)).sort((a, b) => a.sort_order - b.sort_order);
  const doneCount = habits.filter((h) => isDone(h.id, day)).length;

  // week table: Monday to Sunday; earlier weeks are view only
  const thisWeek = mondayOf(day);
  const [weekState, setWeekState] = useState<string | null>(null);
  const week = weekState ?? thisWeek;
  const setWeek = (w: string) => setWeekState(w === thisWeek ? null : w);
  const weekDays = dateRange(week, addDays(week, 6));
  const weekHabits = allHabits
    .filter((h) => weekDays.some((d) => habitDueOn(h, d)) && weekDays.some((d) => !settingsOn(h, d).hidden))
    .sort((a, b) => a.sort_order - b.sort_order || (a.active_from ?? "").localeCompare(b.active_from ?? ""));
  const running = new Set(allHabits.filter((h) => !h.active_until || h.active_until >= day).map((h) => h.title.trim().toLowerCase()));
  const stopped = allHabits
    .filter((h) => h.active_until && h.active_until < day && !running.has(h.title.trim().toLowerCase()))
    .sort((a, b) => (b.active_until ?? "").localeCompare(a.active_until ?? ""));

  return (
    <div className="p-4 md:p-10 max-w-3xl space-y-8">
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold">Habits</h1>
          <div className="text-muted text-sm">Today is {longDayLabel(day)}</div>
        </div>
        <NextDayButton />
      </header>
      <LateNightNote />

      <section>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <h2 className="font-semibold">
            <span className="text-muted font-normal text-sm">{doneCount}/{habits.length} done today</span>
          </h2>
          <div className="flex-1" />
          {habits.length > 0 && (
            <button className="text-sm text-muted hover:text-text" onClick={() => setStopping(true)}>Stop habits…</button>
          )}
          <button className="text-sm text-muted hover:text-text" onClick={() => setEditing(blankItem("habit"))}>+ Habit</button>
        </div>
        <div className="flex items-center gap-2 mb-2 text-sm">
          <button className="btn" onClick={() => setWeek(addDays(week, -7))} aria-label="Previous week">‹</button>
          <span className="font-medium w-36 text-center">{dayMonthLabel(week)} – {dayMonthLabel(addDays(week, 6))}</span>
          <button className="btn" onClick={() => setWeek(addDays(week, 7))} aria-label="Next week">›</button>
          {week !== thisWeek && <button className="btn" onClick={() => setWeekState(null)}>This week</button>}
        </div>
        <WeekTable habits={weekHabits} days={weekDays} today={day} onEdit={setEditing} />
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

function WeekTable({ habits, days, today, onEdit }: { habits: Item[]; days: string[]; today: string; onEdit: (h: Item) => void }) {
  const { isDone, toggle } = useStore();
  if (!habits.length) return <p className="text-sm text-muted border-t border-line pt-3">No habits this week.</p>;
  return (
    <div className="overflow-x-auto border-t border-line">
      <table className="border-collapse text-sm min-w-full">
        <thead>
          <tr className="text-muted">
            <th className="sticky left-0 bg-bg text-left font-normal py-2 pr-4 pl-2 border-b border-r border-line">Day</th>
            {habits.map((h) => (
              <th key={h.id} className="font-normal px-3 py-2 border-b border-r border-line text-left whitespace-nowrap">
                <button className="hover:text-text" onClick={() => onEdit(h)} title={h.description || "Edit habit"}>
                  {h.title}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d} className={d === today ? "bg-accent-soft" : d > today ? "opacity-50" : ""}>
              <td className="sticky left-0 bg-bg py-2.5 pl-2 pr-4 border-b border-r border-line font-semibold whitespace-nowrap">
                {shortDayLabel(d)}
                {d === today && <span className="ml-2 text-[10px] text-accent font-normal">TODAY</span>}
              </td>
              {habits.map((h) => (
                <td key={h.id} className="px-3 border-b border-r border-line">
                  {habitDueOn(h, d) && !settingsOn(h, d).hidden ? (
                    <input
                      type="checkbox"
                      className="check disabled:cursor-default"
                      checked={isDone(h.id, d)}
                      disabled={d !== today}
                      title={d === today ? undefined : "Only today can be ticked"}
                      onChange={() => toggle(h.id, d)}
                      aria-label={`${h.title} ${d}`}
                    />
                  ) : (
                    <span className="text-line">–</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
