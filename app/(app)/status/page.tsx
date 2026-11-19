"use client";

import { useGame } from "@/lib/useGame";
import { Meter } from "@/components/Meter";
import { MAX_LEVEL } from "@/lib/game";
import { dayMonthLabel, todayKey } from "@/lib/dates";
import { useStore } from "@/lib/store";

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

export default function StatusPage() {
  const { game, startDate, setStartDate } = useGame();
  const { items } = useStore();
  if (!game) return <div className="p-10 text-muted">Loading…</div>;
  const { today } = game;
  const firstHabitDay = items
    .filter((i) => i.type === "habit" && i.active_from)
    .map((i) => i.active_from!)
    .sort()[0];

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
            {today.atStake ? ` · −${today.atStake} XP if the rest stay unticked when you start the next day` : " · all done"}
          </p>
        ) : (
          <p className="text-sm text-muted">No habits are due today.</p>
        )}
      </section>

      {/* Log */}
      <section className="space-y-2">
        <h2 className="font-semibold">Log</h2>
        <ul className="divide-y divide-line border-y border-line text-sm">
          {game.log.slice(0, 40).map((l, i) => (
            <li key={i} className="flex gap-3 py-2">
              <span className="text-muted w-14 shrink-0">{dayMonthLabel(l.date)}</span>
              <span className="flex-1">{l.text}</span>
              <span className={`tabular-nums ${l.xp < 0 ? "text-muted" : ""}`}>{l.xp ? `${signed(l.xp)} XP` : ""}</span>
            </li>
          ))}
          {!game.log.length && <li className="py-2 text-muted">Nothing yet. A day is added here when you start the next one.</li>}
        </ul>
      </section>

      {/* Rules + start date */}
      <section className="space-y-3 text-sm">
        <details className="rounded-sm border border-line p-3">
          <summary className="cursor-pointer font-semibold">How it works</summary>
          <ul className="list-disc pl-5 mt-2 space-y-1 text-muted">
            <li>Each habit is worth some XP (shown on Today). Tick it and you gain that XP; miss it and you lose the same amount.</li>
            <li>A habit is worth more if it&apos;s harder, done less often in the week, or one you usually skip, and a bit more for each day in a row you do it.</li>
            <li>Ticks count straight away. Unticked habits cost XP when you start the next day. Days you don&apos;t open the app count as missed.</li>
            <li>Stopped habits stop counting from the day after they stop.</li>
            <li>Levels run 1–{MAX_LEVEL}. Each level needs a bit more XP than the last. Lose enough XP and you drop a level.</li>
            <li>Hidden habits don&apos;t count. Everything is recalculated from your ticks, so Undo and edits apply straight away.</li>
          </ul>
        </details>
        <div className="flex flex-wrap items-center gap-2 text-muted">
          <span>Counting from {startDate ? dayMonthLabel(startDate) : "…"}.</span>
          <button className="btn text-xs" onClick={() => setStartDate(todayKey())}>Restart from today</button>
          {firstHabitDay && firstHabitDay !== startDate && (
            <button className="btn text-xs" onClick={() => setStartDate(firstHabitDay)}>
              Count my history from {dayMonthLabel(firstHabitDay)}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
