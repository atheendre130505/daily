"use client";

import Link from "next/link";
import { useGame, useLevelChange } from "@/lib/useGame";
import { Meter } from "./Meter";
import type { GameState } from "@/lib/game";

/** Compact level + daily quest panel for the Today page. */
export function GameSummary({ game: given }: { game?: GameState | null } = {}) {
  const own = useGame();
  const game = given ?? own.game;
  const change = useLevelChange(game?.level);
  if (!game) return null;
  const { today } = game;
  return (
    <section className="rounded-md border border-line p-4 space-y-3">
      {change && (
        <div className="text-sm font-semibold border-b border-line pb-2">
          {change.to > change.from ? `Level up: ${change.from} → ${change.to}` : `Level down: ${change.from} → ${change.to}`}
        </div>
      )}
      <div className="flex items-baseline gap-3">
        <span className="text-xs uppercase tracking-widest text-muted">Level</span>
        <span className="text-2xl font-bold tabular-nums">{game.level}</span>
        <span className="text-sm">{game.rank}</span>
        <div className="flex-1" />
        <Link href="/status" className="text-xs text-muted hover:text-text">Status ›</Link>
      </div>
      <Meter value={game.xpForNext ? game.xpIntoLevel / game.xpForNext : 1} height={6} label="XP to next level" />
      <div className="text-xs text-muted flex justify-between">
        <span>{game.xpForNext ? `${game.xpIntoLevel} / ${game.xpForNext} XP` : "Max level"}</span>
        <span>Streak {game.streak}</span>
      </div>
      {today.due > 0 && (
        <div className="pt-1 space-y-1.5">
          <div className="flex justify-between text-sm">
            <span>Daily quest · need {Math.round(today.required * 100)}%</span>
            <span className="font-semibold tabular-nums">{Math.round(today.pct * 100)}%</span>
          </div>
          <Meter value={today.pct} marker={today.required} height={10} label="Daily quest" />
          <div className="text-xs text-muted">{today.cleared ? `Cleared · +${today.xpIfCleared} XP at midnight` : `Clear it for +${today.xpIfCleared} XP · the day is scored at midnight`}</div>
        </div>
      )}
    </section>
  );
}
