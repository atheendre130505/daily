"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { StoreProvider, useStore } from "@/lib/store";
import { migrateCookieSession, sendEmailCode, signInWithPassword, supabaseBrowser, supabaseConfigured, verifyEmailCode } from "@/lib/supabase/client";
import { PanelButton, UIProvider, useUI } from "@/lib/ui";
import { UndoButton, UndoToast } from "./UndoBar";
import { Icon } from "./Icon";

const NAV = [
  { href: "/today", label: "Today", icon: "today" },
  { href: "/habits", label: "Habits", icon: "habits" },
  { href: "/notes", label: "Notes", icon: "notes" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<"loading" | "in" | "out">("loading");

  useEffect(() => {
    if (!supabaseConfigured) return;
    const sb = supabaseBrowser();
    // carry over an older cookie sign-in first, so this device stays signed in
    migrateCookieSession().then(() => sb.auth.getSession()).then(({ data }) => setAuth(data.session ? "in" : "out"));
    const { data } = sb.auth.onAuthStateChange((_e, s) => setAuth(s ? "in" : "out"));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // plain web page: remove any old offline cache so a reload always shows the latest version
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
      if ("caches" in window) caches.keys().then((ks) => ks.forEach((k) => caches.delete(k))).catch(() => {});
    }
  }, []);

  if (!supabaseConfigured) return <div className="p-8 text-muted">Daily isn&apos;t connected to its database (missing Supabase settings).</div>;
  if (auth === "loading") return <div className="p-8 text-muted">Loading…</div>;
  if (auth === "out") return <SignIn />;

  return (
    <StoreProvider>
      <UIProvider>
        <Frame>{children}</Frame>
      </UIProvider>
    </StoreProvider>
  );
}

function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPw] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"password" | "code" | "codeSent">("password");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>, ok?: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      if (ok) setMsg(ok);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh grid place-items-center p-6">
      <div className="max-w-sm w-full space-y-4">
        <h1 className="text-3xl font-bold text-center">Daily</h1>
        <input className="input" type="email" required autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />

        {mode === "password" && (
          <form className="space-y-3" onSubmit={(e) => (e.preventDefault(), run(() => signInWithPassword(email, password)))}>
            <input className="input" type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={(e) => setPw(e.target.value)} />
            <button className="btn btn-primary w-full justify-center" disabled={busy || !email || !password}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <p className="text-xs text-muted text-center">You stay signed in on this device until you sign out.</p>
            <button type="button" className="w-full text-xs text-muted hover:text-text" onClick={() => (setMode("code"), setMsg(null))}>
              No password yet? Use a sign-in code instead
            </button>
          </form>
        )}

        {mode === "code" && (
          <div className="space-y-3">
            <button className="btn btn-primary w-full justify-center" disabled={busy || !email} onClick={() => run(async () => (await sendEmailCode(email), setMode("codeSent")))}>
              {busy ? "Sending…" : "Email me a code"}
            </button>
            <button type="button" className="w-full text-xs text-muted hover:text-text disabled:opacity-40" disabled={!email} onClick={() => (setMode("codeSent"), setMsg(null))}>
              I already have a code
            </button>
            <button type="button" className="w-full text-xs text-muted hover:text-text" onClick={() => (setMode("password"), setMsg(null))}>
              Back to password
            </button>
          </div>
        )}

        {mode === "codeSent" && (
          <form className="space-y-3" onSubmit={(e) => (e.preventDefault(), run(() => verifyEmailCode(email, code)))}>
            <input
              className="input text-center text-2xl tracking-[0.4em] tabular-nums"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              placeholder="code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/D/g, ""))}
              autoFocus
            />
            <button className="btn btn-primary w-full justify-center" disabled={busy || code.length < 6}>
              {busy ? "Checking…" : "Sign in"}
            </button>
            <button type="button" className="w-full text-xs text-muted hover:text-text" onClick={() => (setMode("password"), setCode(""), setMsg(null))}>
              Back to password
            </button>
          </form>
        )}
        {msg && <p className="text-sm text-center">{msg}</p>}
      </div>
    </div>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { error, ready } = useStore();
  const { navOpen, setNavOpen } = useUI();
  return (
    <div className="min-h-dvh md:flex">
      {!navOpen && (
        <PanelButton onClick={() => setNavOpen(true)} title="Show menu (Ctrl+\ for focus mode)" className="fixed bottom-3 left-3 z-40 bg-panel border border-line">
          ☰
        </PanelButton>
      )}
      <aside className={`${navOpen ? "md:flex" : ""} hidden w-56 shrink-0 flex-col gap-1 border-r border-line bg-panel p-3 sticky top-0 h-dvh`}>
        <div className="flex items-center px-2 py-3">
          <span className="text-lg font-semibold flex-1">Daily</span>
          <PanelButton onClick={() => setNavOpen(false)} title="Hide menu (Ctrl+\ hides everything)">«</PanelButton>
        </div>
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
              path.startsWith(n.href) ? "bg-panel-2 text-text" : "text-muted hover:bg-panel-2"
            }`}
          >
            <span className="w-5 grid place-items-center"><Icon name={n.icon} /></span>
            {n.label}
          </Link>
        ))}
        <div className="mt-auto space-y-1">
          <UndoButton />
          <Link href="/settings" className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted hover:bg-panel-2 ${path === "/settings" ? "bg-panel-2" : ""}`}>
            <span className="w-5 grid place-items-center"><Icon name="settings" /></span>Settings
          </Link>
        </div>
      </aside>

      <main className="flex-1 min-w-0 pb-24 md:pb-0">
        {error && <div className="bg-panel-2 border-b border-line text-sm px-4 py-2">{error}</div>}
        {ready ? children : <div className="p-8 text-muted">Loading…</div>}
      </main>
      <UndoToast />

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 grid grid-cols-3 border-t border-line bg-panel pb-[env(safe-area-inset-bottom)]">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${path.startsWith(n.href) ? "text-text" : "text-muted"}`}>
            <Icon name={n.icon} size={20} />
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
