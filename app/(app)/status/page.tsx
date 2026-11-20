"use client";

import { useGame } from "@/lib/useGame";
import { Meter } from "@/components/Meter";
import { MAX_LEVEL } from "@/lib/game";
import { dayMonthLabel, todayKey } from "@/lib/dates";


export default function StatusPage() {
  const { game, startDate, setStartDate } = useGame();
  if (!game) return <div className="p-10 text-muted">Loading…</div>;
  const { today } = game;

  return (
    <div className="p-4 md:p-10 max-w-3xl space-y-10">
      {/* Level */}
      <section>
        <div className="text-xs uppercase tracking-widest text-muted">Status</div>
        <div className="flex items-end gap-4 mt-2">
          <div className="text-6xl font-bold leading-none tabular-nums">{game.level}</div>
          <div className="pb-1">
            <div className="text-xs uppercase tracking-widest text-muted">Level</div>
            <div className="text-lg font-semibold">{game.rank}</div>
          </div>
          <div className="flex-1" />
          <div className="text-right text-sm text-muted pb-1">
            <div>{game.xp.toLocaleString()} XP total</div>
            <div>Highest level: {game.peakLevel}</div>
          </div>
        </div>
        <div className="mt-4">
          <Meter value={game.xpForNext ? game.xpIntoLevel / game.xpForNext : 1} height={10} label="XP to next level" />
          <div className="flex justify-between text-xs text-muted mt-1.5">
            <span>{game.level >= MAX_LEVEL ? "Max level" : `${game.xpIntoLevel} / ${game.xpForNext} XP to level ${game.level + 1}`}</span>
          </div>
        </div>
      </section>

      {/* Today */}
      <section className="space-y-2">
        <h2 className="font-semibold">Today</h2>
        {today.due ? (
          <p className="text-sm text-muted">
            {today.done}/{today.due} done · <span className="text-text">+{today.earnedSoFar} XP</span> so far
          </p>
        ) : (
          <p className="text-sm text-muted">No habits are due today.</p>
        )}
      </section>

      {/* Rules + start date */}
      <section className="space-y-3 text-sm">
        <details className="rounded-sm border border-line p-3">
          <summary className="cursor-pointer font-semibold">How it works</summary>
          <ul className="list-disc pl-5 mt-2 space-y-1 text-muted">
            <li>Each habit is worth some XP (shown on Today). Tick it and you gain that XP. Missing it costs nothing; XP only goes up.</li>
            <li>A habit is worth more if it&apos;s harder, done less often in the week, or one you usually skip, and a bit more for each day in a row you do it.</li>
            <li>Ticks count straight away.</li>
            <li>Stopped habits stop counting from the day after they stop.</li>
            <li>Levels run 1–{MAX_LEVEL}. Each level needs a bit more XP than the last.</li>
            <li>Hidden habits don&apos;t count. Everything is recalculated from your ticks, so Undo and edits apply straight away.</li>
          </ul>
        </details>
        <div className="flex flex-wrap items-center gap-2 text-muted">
          <span>Counting from {startDate ? dayMonthLabel(startDate) : "…"}.</span>
          <button className="btn text-xs" onClick={() => setStartDate(todayKey())}>Restart from today</button>
        </div>
      </section>
    </div>
  );
}
