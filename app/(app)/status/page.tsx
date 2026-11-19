"use client";

import { useGame } from "@/lib/useGame";
import { Meter } from "@/components/Meter";
import { MAX_LEVEL, TIERS } from "@/lib/game";
import { dayMonthLabel, todayKey } from "@/lib/dates";
import { useStore } from "@/lib/store";

const pct = (x: number) => `${Math.round(x * 100)}%`;
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

export default function StatusPage() {
  const { game, startDate, setStartDate } = useGame();
  const { items } = useStore();
  if (!game) return <div className="p-10 text-muted">Loading…</div>;
  const { today, week } = game;
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
            <span>Streak: {game.streak} day{game.streak === 1 ? "" : "s"}</span>
          </div>
        </div>
      </section>

      {/* Daily quest */}
      <section className="space-y-3">
        <h2 className="font-semibold">Daily quest</h2>
        {today.due ? (
          <>
            <p className="text-sm text-muted">
              Tick at least <span className="text-text font-medium">{pct(today.required)}</span> of today&apos;s {today.due} habits.
            </p>
            <Meter value={today.pct} marker={today.required} height={14} label="Today's completion" />
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <span>
                {today.done}/{today.due} done · <span className="font-semibold">{pct(today.pct)}</span>
              </span>
              <span className="text-muted">
                {today.cleared ? `Cleared · +${today.xpIfCleared} XP at midnight` : `Clear it: +${today.xpIfCleared} XP · if the day ended now: ${today.xpIfFailedNow} XP`}
              </span>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted">No habits are due today, so there&apos;s no quest.</p>
        )}
      </section>

      {/* Week + difficulty */}
      <section className="space-y-3">
        <h2 className="font-semibold">
          This week · {dayMonthLabel(week.start)} – {dayMonthLabel(week.end)}
        </h2>
        <Meter value={week.questDays ? week.cleared / week.questDays : 0} marker={week.questDays ? week.promoteNeeds / week.questDays : undefined} label="Quest days cleared this week" />
        <p className="text-sm text-muted">
          {week.cleared} of {week.questDays} quest days cleared, {week.daysLeft} left. Clear <span className="text-text">{week.promoteNeeds}</span> to raise the difficulty
          {game.tier < TIERS.length - 1 ? ` to ${pct(TIERS[game.tier + 1])}` : " (already at the top: bonus XP instead)"}; fewer than {week.demoteBelow} lowers it.
        </p>
        <div className="flex gap-1.5" aria-label="Difficulty">
          {TIERS.map((t, i) => (
            <div key={t} className={`flex-1 text-center text-xs py-1.5 rounded-sm border ${i === game.tier ? "border-text text-text font-semibold" : i < game.tier ? "border-line bg-panel-2 text-muted" : "border-line text-muted"}`}>
              {pct(t)}
            </div>
          ))}
        </div>
      </section>

      {/* Challenges */}
      <section className="space-y-3">
        <h2 className="font-semibold">Weekly challenges</h2>
        <p className="text-sm text-muted">Hit each target by Sunday. Met: +25 XP and next week&apos;s target goes up by one. Missed: −15 XP.</p>
        <ul className="space-y-3">
          {game.challenges.map((c) => (
            <li key={c.habitId}>
              <div className="flex justify-between text-sm mb-1">
                <span>{c.title}</span>
                <span className={c.done >= c.target ? "font-semibold" : "text-muted"}>
                  {c.done} / {c.target}
                  {c.done >= c.target ? " · met" : ""}
                </span>
              </div>
              <Meter value={c.done / c.target} height={6} label={`${c.title} challenge`} />
            </li>
          ))}
          {!game.challenges.length && <li className="text-sm text-muted">No habits running this week.</li>}
        </ul>
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
          {!game.log.length && <li className="py-2 text-muted">Nothing yet. Your first day is scored at midnight.</li>}
        </ul>
      </section>

      {/* Rules + start date */}
      <section className="space-y-3 text-sm">
        <details className="rounded-sm border border-line p-3">
          <summary className="cursor-pointer font-semibold">How it works</summary>
          <ul className="list-disc pl-5 mt-2 space-y-1 text-muted">
            <li>Each habit is worth some XP (shown on Today). Tick it and you gain that XP; miss it and you lose the same amount.</li>
            <li>Each day with habits due is a quest. Tick at least the required % to clear it.</li>
            <li>Cleared: +40 XP (+10 per difficulty step, +20 for a perfect day), boosted by up to 50% for a clear streak.</li>
            <li>Failed: you lose XP in proportion to how much you missed (at least 10). Days you don&apos;t open the app count as 0%.</li>
            <li>Each Monday the past week is reviewed: clear 70% of quest days to raise the difficulty (+150 XP); under 40% lowers it (−100 XP).</li>
            <li>Weekly challenges per habit start at 60% of its days and rise by one each week you meet them.</li>
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
