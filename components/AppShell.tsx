"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { StoreProvider, useStore } from "@/lib/store";
import { sendEmailCode, supabaseBrowser, supabaseConfigured, verifyEmailCode } from "@/lib/supabase/client";
import { BASE } from "@/lib/base";
import { PanelButton, UIProvider, useUI } from "@/lib/ui";
import { UndoButton, UndoToast } from "./UndoBar";
import { Icon } from "./Icon";

const NAV = [
  { href: "/today", label: "Today", icon: "today" },
  { href: "/status", label: "Status", icon: "status" },
  { href: "/habits", label: "Habits", icon: "habits" },
  { href: "/notes", label: "Notes", icon: "notes" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<"loading" | "in" | "out">("loading");

  useEffect(() => {
    if (!supabaseConfigured) return;
    const sb = supabaseBrowser();
    sb.auth.getSession().then(({ data }) => setAuth(data.session ? "in" : "out"));
    const { data } = sb.auth.onAuthStateChange((_e, s) => setAuth(s ? "in" : "out"));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register(`${BASE}/sw.js`, { scope: `${BASE}/` }).catch(() => {});
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
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
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
        {!sent ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await sendEmailCode(email);
                setSent(true);
              });
            }}
          >
            <p className="text-muted text-sm text-center">Sign in with your email. We&apos;ll send you a 6-digit code.</p>
            <input className="input" type="email" required autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="btn btn-primary w-full justify-center" disabled={busy || !email}>
              {busy ? "Sending…" : "Send code"}
            </button>
          </form>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => verifyEmailCode(email, code));
            }}
          >
            <p className="text-muted text-sm text-center">Enter the code sent to {email}.</p>
            <input
              className="input text-center text-2xl tracking-[0.4em] tabular-nums"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/D/g, ""))}
              autoFocus
            />
            <button className="btn btn-primary w-full justify-center" disabled={busy || code.length < 6}>
              {busy ? "Checking…" : "Sign in"}
            </button>
            <div className="flex justify-between text-xs text-muted">
              <button type="button" className="hover:text-text" onClick={() => (setSent(false), setCode(""), setMsg(null))}>Use a different email</button>
              <button type="button" className="hover:text-text" disabled={busy} onClick={() => run(() => sendEmailCode(email), "A new code is on its way.")}>Resend code</button>
            </div>
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

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 grid grid-cols-4 border-t border-line bg-panel pb-[env(safe-area-inset-bottom)]">
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
