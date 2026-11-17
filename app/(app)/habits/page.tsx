"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { dateRange, dayMonthLabel, fromDateKey, monthLabel, shortDayLabel, toDateKey, todayKey } from "@/lib/dates";
import { habitDueOn } from "@/lib/recurrence";
import { completionRate, currentStreak } from "@/lib/stats";
import { habitSegments, type Segment } from "@/lib/segments";
import { ItemEditor, blankItem, restartHabit } from "@/components/ItemEditor";
import { StopHabitsDialog } from "@/components/StopHabitsDialog";
import type { Item } from "@/lib/types";

function monthBounds(anchor: string): [string, string] {
  const d = fromDateKey(anchor);
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return [toDateKey(first), toDateKey(last)];
}

const norm = (h: Item) => h.title.trim().toLowerCase();
const rangeLabel = (a: string, b: string) => (a === b ? shortDayLabel(a) : `${shortDayLabel(a)} – ${shortDayLabel(b)}`);

export default function HabitsPage() {
  const { items, isDone, saveItem } = useStore();
  const [anchor, setAnchor] = useState(todayKey());
  const [showHidden, setShowHidden] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [stopping, setStopping] = useState(false);
  const [from, to] = monthBounds(anchor);
  const today = todayKey();

  const allHabits = items.filter((i) => i.type === "habit");
  const visible = useMemo(() => allHabits.filter((h) => showHidden || !h.hidden), [allHabits, showHidden]);
  const segments = useMemo(() => habitSegments(visible, dateRange(from, to)), [visible, from, to]);
  const hiddenCount = allHabits.filter((h) => h.hidden).length;
  const stopped = allHabits
    .filter((h) => h.active_until && h.active_until < today)
    .sort((a, b) => (b.active_until ?? "").localeCompare(a.active_until ?? ""));
  // names that are running (or scheduled) again, so their old runs don't offer "Start again"
  const runningTitles = new Set(allHabits.filter((h) => !h.active_until || h.active_until >= today).map((h) => h.title.trim().toLowerCase()));

  const shift = (months: number) => {
    const d = fromDateKey(anchor);
    setAnchor(toDateKey(new Date(d.getFullYear(), d.getMonth() + months, 1)));
  };

  return (
    <div className="p-4 md:p-10 max-w-6xl">
      <h1 className="text-3xl md:text-4xl font-bold">Daily Checklist</h1>
      <p className="text-muted mt-1">Tick today&apos;s boxes. Past and future days are locked. Starting or stopping a habit starts a new table from that day.</p>

      <div className="flex flex-wrap items-center gap-2 mt-6 mb-3">
        <button className="btn" onClick={() => shift(-1)}>‹</button>
        <div className="font-medium w-28 text-center">{monthLabel(from)}</div>
        <button className="btn" onClick={() => shift(1)}>›</button>
        <button className="btn" onClick={() => setAnchor(today)}>Today</button>
        <div className="flex-1" />
        {hiddenCount > 0 && (
          <button className="btn text-xs" onClick={() => setShowHidden((s) => !s)}>
            {showHidden ? "Hide" : "Show"} hidden ({hiddenCount})
          </button>
        )}
        <button className="btn" onClick={() => setStopping(true)}>
          ■ Stop habits…
        </button>
        <button className="btn btn-primary" onClick={() => setEditing(blankItem("habit"))}>
          + Habit
        </button>
      </div>

      <div className="space-y-8">
        {segments.map((seg) => (
          <SegmentTable key={seg.from} seg={seg} today={today} showHeader={segments.length > 1} onEdit={setEditing} />
        ))}
      </div>

      {stopped.length > 0 && (
        <section className="mt-12">
          <h2 className="font-semibold mb-2">Stopped habits</h2>
          <ul className="divide-y divide-line border-y border-line">
            {stopped.map((h) => {
              const r = completionRate(h, isDone, h.active_from ?? h.active_until!, h.active_until!);
              return (
                <li key={h.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                  <button className="font-medium hover:underline" onClick={() => setEditing(h)}>{h.title}</button>
                  <span className="text-muted">
                    {h.active_from ? `${dayMonthLabel(h.active_from)} – ${dayMonthLabel(h.active_until!)}` : `until ${dayMonthLabel(h.active_until!)}`}
                  </span>
                  <span className="text-muted">{r === null ? "" : `${Math.round(r * 100)}% done`}</span>
                  <div className="flex-1" />
                  {runningTitles.has(h.title.trim().toLowerCase()) ? (
                    <span className="text-xs text-accent">running again</span>
                  ) : (
                    <button className="btn text-xs" onClick={() => saveItem(restartHabit(h, today, allHabits), `Restarted "${h.title}"`)}>
                      Start again today
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {editing && <ItemEditor item={editing} onClose={() => setEditing(null)} />}
      {stopping && <StopHabitsDialog onClose={() => setStopping(false)} />}
    </div>
  );
}

function SegmentTable({ seg, today, showHeader, onEdit }: { seg: Segment; today: string; showHeader: boolean; onEdit: (h: Item) => void }) {
  const { isDone, toggle } = useStore();
  const isCurrent = seg.from <= today && today <= seg.to;
  // same habit name stopped and started on the same day = a restart
  const stoppedNames = new Set(seg.stopped.map(norm));
  const restarted = new Set(seg.started.map(norm).filter((n) => stoppedNames.has(n)));
  return (
    <section>
      {showHeader && (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-2">
          <h2 className="font-semibold">{rangeLabel(seg.from, seg.to)}</h2>
          {seg.started.map((h) =>
            restarted.has(norm(h)) ? (
              <span key={h.id} className="text-xs rounded px-1.5 py-0.5 bg-accent-soft text-accent">↻ {h.title} restarted</span>
            ) : (
              <span key={h.id} className="text-xs rounded px-1.5 py-0.5 bg-accent-soft text-accent">+ {h.title} started</span>
            ),
          )}
          {seg.stopped
            .filter((h) => !restarted.has(norm(h)))
            .map((h) => (
              <span key={h.id} className="text-xs rounded px-1.5 py-0.5 bg-panel-2 text-muted">■ {h.title} stopped</span>
            ))}
        </div>
      )}
      {seg.habits.length === 0 ? (
        <p className="text-sm text-muted border-t border-line pt-3">No habits were active on these days.</p>
      ) : (
        <div className="overflow-x-auto border-t border-line">
          <table className="border-collapse text-sm min-w-full">
            <thead>
              <tr className="text-muted">
                <th className="sticky left-0 bg-bg text-left font-normal py-2 pr-4 pl-2 border-b border-r border-line min-w-24">Day</th>
                {seg.habits.map((h) => (
                  <th key={h.id} className="font-normal px-3 py-2 border-b border-r border-line text-left whitespace-nowrap">
                    <button className="flex items-center gap-1.5 hover:text-text" onClick={() => onEdit(h)} title={h.description || "Edit habit"}>
                      {h.title}
                      {h.description && <span className="text-xs opacity-70">ⓘ</span>}
                      {h.active_until && h.active_until >= today && <span className="text-[10px] text-muted">until {shortDayLabel(h.active_until)}</span>}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {seg.days.map((d) => (
                <tr key={d} className={d === today ? "bg-accent-soft" : d > today ? "opacity-60" : ""}>
                  <td className="sticky left-0 bg-bg py-2.5 pl-2 pr-4 border-b border-r border-line font-semibold whitespace-nowrap">
                    {shortDayLabel(d)}
                    {d === today && <span className="ml-2 text-[10px] text-accent font-normal">TODAY</span>}
                  </td>
                  {seg.habits.map((h) => (
                    <td key={h.id} className="px-3 border-b border-r border-line">
                      {habitDueOn(h, d) ? (
                        <input
                          type="checkbox"
                          className="check disabled:opacity-40 disabled:cursor-not-allowed"
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
            <tfoot>
              <tr className="text-muted text-xs">
                <td className="sticky left-0 bg-bg py-2 pl-2 border-r border-line">Done</td>
                {seg.habits.map((h) => {
                  const r = completionRate(h, isDone, seg.from, seg.to);
                  return (
                    <td key={h.id} className="px-3 py-2 border-r border-line">
                      {r === null ? "–" : `${Math.round(r * 100)}%`}
                    </td>
                  );
                })}
              </tr>
              {isCurrent && (
                <tr className="text-muted text-xs">
                  <td className="sticky left-0 bg-bg py-2 pl-2 border-r border-line">Streak</td>
                  {seg.habits.map((h) => (
                    <td key={h.id} className="px-3 py-2 border-r border-line">
                      {currentStreak(h, isDone, today)}
                    </td>
                  ))}
                </tr>
              )}
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
