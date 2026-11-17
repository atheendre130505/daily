"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { addDays, todayKey } from "@/lib/dates";
import { habitActiveOn } from "@/lib/recurrence";

/** Pick several running habits and stop them together (one change, one Undo). */
export function StopHabitsDialog({ onClose }: { onClose: () => void }) {
  const { items, saveItems } = useStore();
  const today = todayKey();
  const yesterday = addDays(today, -1);
  const running = items
    .filter((i) => i.type === "habit" && habitActiveOn(i, today) && (!i.active_until || i.active_until >= today))
    .sort((a, b) => a.sort_order - b.sort_order);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const chosen = running.filter((h) => picked.has(h.id));
  const startedToday = chosen.filter((h) => h.active_from && h.active_from >= today);

  const stop = (lastDay: string, how: string) => {
    const names = chosen.map((h) => h.title);
    const label = names.length === 1 ? `Stopped "${names[0]}"` : `Stopped ${names.length} habits (${names.join(", ")})`;
    saveItems(
      chosen.map((h) => ({ ...h, active_until: lastDay })),
      `${label} ${how}`,
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-end md:place-items-center" onClick={onClose}>
      <div className="w-full md:max-w-md bg-panel border border-line rounded-t-xl md:rounded-xl p-5 space-y-4 max-h-[90dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div>
          <h2 className="text-lg font-semibold">Stop habits</h2>
          <p className="text-sm text-muted">Pick one or more. Their ticks are kept, and the checklist starts a new table without them.</p>
        </div>

        <div className="flex gap-3 text-xs">
          <button className="text-accent hover:underline" onClick={() => setPicked(new Set(running.map((h) => h.id)))}>Select all</button>
          <button className="text-muted hover:underline" onClick={() => setPicked(new Set())}>Clear</button>
        </div>

        <ul className="divide-y divide-line border-y border-line">
          {running.map((h) => (
            <li key={h.id}>
              <label className="flex items-center gap-3 py-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  className="check"
                  checked={picked.has(h.id)}
                  onChange={() =>
                    setPicked((s) => {
                      const n = new Set(s);
                      if (n.has(h.id)) n.delete(h.id);
                      else n.add(h.id);
                      return n;
                    })
                  }
                />
                <span className="flex-1">{h.title}</span>
                {h.hidden && <span className="text-xs text-muted">hidden</span>}
              </label>
            </li>
          ))}
          {!running.length && <li className="py-3 text-sm text-muted">No habits are running.</li>}
        </ul>

        <div className="space-y-2">
          <button className="btn btn-primary w-full justify-center" disabled={!chosen.length} onClick={() => stop(today, "after today")}>
            Stop {chosen.length || ""} after today
          </button>
          <button
            className="btn w-full justify-center disabled:opacity-40"
            disabled={!chosen.length || startedToday.length > 0}
            onClick={() => stop(yesterday, "from today")}
          >
            Stop {chosen.length || ""} from today (yesterday was the last day)
          </button>
          {startedToday.length > 0 && (
            <p className="text-xs text-muted">
              {startedToday.map((h) => h.title).join(", ")} started today, so it can only stop after today (or delete it instead).
            </p>
          )}
          <button className="btn w-full justify-center" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
