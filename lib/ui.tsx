"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/** Which side columns are visible. Remembered per device; Ctrl+\ toggles focus mode (both hidden). */
interface UI {
  navOpen: boolean;
  treeOpen: boolean;
  setNavOpen(v: boolean): void;
  setTreeOpen(v: boolean): void;
  toggleFocus(): void;
}

const KEY = "daily-ui-v1";
const Ctx = createContext<UI | null>(null);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [navOpen, setNav] = useState(true);
  const [treeOpen, setTree] = useState(true);

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) ?? "{}");
      if (typeof s.navOpen === "boolean") setNav(s.navOpen);
      if (typeof s.treeOpen === "boolean") setTree(s.treeOpen);
    } catch {}
  }, []);

  const persist = useCallback((n: boolean, t: boolean) => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ navOpen: n, treeOpen: t }));
    } catch {}
  }, []);

  const ui = useMemo<UI>(
    () => ({
      navOpen,
      treeOpen,
      setNavOpen: (v) => (setNav(v), persist(v, treeOpen)),
      setTreeOpen: (v) => (setTree(v), persist(navOpen, v)),
      toggleFocus: () => {
        const show = !(navOpen || treeOpen); // if anything is showing, hide everything; else show both
        setNav(show);
        setTree(show);
        persist(show, show);
      },
    }),
    [navOpen, treeOpen, persist],
  );

  useEffect(() => {
    // Capture phase, so it still works while typing in the editor (which handles its own keys).
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === "\\" || e.code === "Backslash" || e.code === "IntlBackslash")) {
        e.preventDefault();
        e.stopPropagation();
        ui.toggleFocus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [ui]);

  return <Ctx.Provider value={ui}>{children}</Ctx.Provider>;
}

export function useUI(): UI {
  const u = useContext(Ctx);
  if (!u) throw new Error("useUI outside UIProvider");
  return u;
}

/** Small square icon button used for the show/hide controls. */
export function PanelButton({ onClick, title, children, className = "" }: { onClick: () => void; title: string; children: React.ReactNode; className?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`hidden md:grid place-items-center w-7 h-7 rounded-md text-muted hover:bg-panel-2 hover:text-text ${className}`}
    >
      {children}
    </button>
  );
}
