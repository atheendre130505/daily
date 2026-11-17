"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "./store";
import { computeGame, type GameState } from "./game";
import { todayKey } from "./dates";
import { supabaseBrowser, supabaseConfigured } from "./supabase/client";

const KEY = "daily-game-v1";

function readLocal(): string | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}").startDate ?? null;
  } catch {
    return null;
  }
}
function writeLocal(d: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ startDate: d }));
  } catch {}
}

/**
 * The levelling state, recomputed from habits and ticks.
 * The game start date is shared through Supabase when signed in (so phone and PC agree), else kept on this device.
 */
export function useGame(): { game: GameState | null; startDate: string | null; setStartDate: (d: string) => void } {
  const { items, isDone } = useStore();
  const [startDate, setStart] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let s = readLocal();
      if (supabaseConfigured) {
        const sb = supabaseBrowser();
        const { data } = await sb.from("user_settings").select("game_start").maybeSingle();
        if (data?.game_start) s = data.game_start;
        else {
          s = s ?? todayKey();
          await sb.from("user_settings").upsert({ game_start: s });
        }
      }
      s = s ?? todayKey(); // a new game starts today at level 1
      writeLocal(s);
      if (!cancelled) setStart(s);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setStartDate = (d: string) => {
    setStart(d);
    writeLocal(d);
    if (supabaseConfigured) supabaseBrowser().from("user_settings").upsert({ game_start: d }).then(() => {});
  };

  const game = useMemo(() => (startDate ? computeGame(items, isDone, startDate, todayKey()) : null), [items, isDone, startDate]);
  return { game, startDate, setStartDate };
}

/** Level-up / level-down notice: compares with the level last seen on this device. */
export function useLevelChange(level: number | undefined): { from: number; to: number } | null {
  const [change, setChange] = useState<{ from: number; to: number } | null>(null);
  useEffect(() => {
    if (!level) return;
    try {
      const seen = Number(localStorage.getItem("daily-game-seen-level") ?? "0");
      if (seen && seen !== level) setChange({ from: seen, to: level });
      localStorage.setItem("daily-game-seen-level", String(level));
    } catch {}
  }, [level]);
  return change;
}
