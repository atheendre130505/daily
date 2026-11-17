"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";

/** True while the user is typing somewhere that has its own undo (text fields, the notes editor). */
function typingInField(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) && !(el as HTMLInputElement).type?.match(/checkbox|radio|button/);
}

/**
 * Toast after each change ("Ticked Exercise · Undo") and Ctrl+Z for app-level changes.
 * Text typed in notes and fields keeps its own Ctrl+Z.
 */
export function UndoToast() {
  const { lastChange, undo } = useStore();
  const [shown, setShown] = useState<{ text: string; canUndo: boolean } | null>(null);
  const seen = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = (text: string, canUndo: boolean) => {
    setShown({ text, canUndo });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setShown(null), 6000);
  };

  // A new change was recorded → show it with an Undo button.
  useEffect(() => {
    if (lastChange && lastChange.id !== seen.current && (seen.current === null || lastChange.id > seen.current)) {
      flash(lastChange.label, true);
    }
    seen.current = lastChange?.id ?? seen.current;
  }, [lastChange]);

  const doUndo = () => {
    if (!lastChange) return;
    const label = lastChange.label;
    undo();
    flash(`Undone: ${label}`, false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z" && !typingInField()) {
        e.preventDefault();
        doUndo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!shown) return null;
  return (
    <div className="fixed z-50 left-1/2 -translate-x-1/2 bottom-20 md:bottom-6 flex items-center gap-3 rounded-lg border border-line bg-panel-2 px-4 py-2.5 text-sm shadow-lg max-w-[92vw]">
      <span className="truncate">{shown.text}</span>
      {shown.canUndo && lastChange && (
        <button className="font-semibold text-accent hover:underline shrink-0" onClick={doUndo}>
          Undo
        </button>
      )}
      <button className="text-muted hover:text-text shrink-0" onClick={() => setShown(null)} aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
}

/** Permanent Undo button for the side menu. */
export function UndoButton() {
  const { lastChange, undo } = useStore();
  return (
    <button
      disabled={!lastChange}
      onClick={undo}
      title={lastChange ? `Undo: ${lastChange.label} (Ctrl+Z)` : "Nothing to undo"}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted hover:bg-panel-2 disabled:opacity-40 disabled:hover:bg-transparent"
    >
      <span className="w-5 text-center">↶</span>
      <span className="truncate">{lastChange ? `Undo: ${lastChange.label}` : "Undo"}</span>
    </button>
  );
}
