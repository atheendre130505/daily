"use client";

import { useStore } from "@/lib/store";
import { addDays, shortDayLabel } from "@/lib/dates";

/** Moves you to the next day. Your day never changes at midnight on its own, so late nights still count for the day you're finishing. */
export function NextDayButton({ className = "" }: { className?: string }) {
  const { day, canStartNextDay, startNextDay } = useStore();
  const next = addDays(day, 1);
  const go = () => {
    if (confirm(`Finish ${shortDayLabel(day)} and start ${shortDayLabel(next)}?\n\n${shortDayLabel(day)} gets locked; you can't go back to it.`)) startNextDay();
  };
  return (
    <button
      className={`btn ${canStartNextDay ? "btn-primary" : ""} disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
      disabled={!canStartNextDay}
      title={canStartNextDay ? `Start ${shortDayLabel(next)}` : `${shortDayLabel(next)} hasn't started yet (after midnight you can start it)`}
      onClick={go}
    >
      Start {shortDayLabel(next)} ›
    </button>
  );
}

/** Shown after midnight while you're still on the previous day. */
export function LateNightNote() {
  const { day, canStartNextDay } = useStore();
  if (!canStartNextDay) return null;
  return (
    <p className="text-sm text-muted border border-line rounded px-3 py-2">
      Past midnight, you&apos;re still on {shortDayLabel(day)}. Ticks count for {shortDayLabel(day)} until you press <b>Start {shortDayLabel(addDays(day, 1))}</b>.
    </p>
  );
}
