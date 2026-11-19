"use client";

import Link from "next/link";
import { useGame, useLevelChange } from "@/lib/useGame";
import { Meter } from "./Meter";
import type { GameState } from "@/lib/game";

/** Compact level panel for the Today page. */
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
      <div className="text-xs text-muted flex flex-wrap justify-between gap-2">
        <span>{game.xpForNext ? `${game.xpIntoLevel} / ${game.xpForNext} XP` : "Max level"}</span>
        {today.due > 0 && (
          <span>
            Today +{today.earnedSoFar} XP{today.atStake ? ` · −${today.atStake} XP if the rest stay unticked` : " · all done"}
          </span>
        )}
      </div>
    </section>
  );
}
