"use client";

import { useStore } from "@/lib/store";
import { useState } from "react";
import { setPassword, supabaseBrowser, supabaseConfigured } from "@/lib/supabase/client";

/** Choose or change the password used to sign in on other devices (no email or code needed). */
function PasswordForm() {
  const [pw, setPw] = useState("");
  const [again, setAgain] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ok = pw.length >= 8 && pw === again;
  return (
    <form
      className="space-y-2 max-w-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMsg(null);
        try {
          await setPassword(pw);
          setPw("");
          setAgain("");
          setMsg("Password saved. Use it with your email to sign in on your phone.");
        } catch (err) {
          setMsg(err instanceof Error ? err.message : String(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <input className="input" type="password" autoComplete="new-password" placeholder="New password (8+ characters)" value={pw} onChange={(e) => setPw(e.target.value)} />
      <input className="input" type="password" autoComplete="new-password" placeholder="Type it again" value={again} onChange={(e) => setAgain(e.target.value)} />
      {again && pw !== again && <p className="text-xs text-muted">The two don&apos;t match yet.</p>}
      <button className="btn btn-primary" disabled={!ok || busy}>{busy ? "Saving…" : "Save password"}</button>
      {msg && <p className="text-sm">{msg}</p>}
    </form>
  );
}

export default function SettingsPage() {
  const { items, pages, completions, mode } = useStore();

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), items, completions, pages }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `daily-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  return (
    <div className="p-4 md:p-10 max-w-2xl space-y-8">
      <h1 className="text-3xl font-bold">Settings</h1>

      <section className="space-y-2">
        <h2 className="font-semibold">Sync</h2>
        <p className="text-sm text-muted">
          {mode === "supabase"
            ? "Signed in. Changes sync live between your devices."
            : "Not connected."}
        </p>
        {supabaseConfigured && (
          <div className="flex gap-2">
            <button className="btn" onClick={() => supabaseBrowser().auth.signOut()}>Sign out</button>
          </div>
        )}
      </section>

      {supabaseConfigured && (
        <section className="space-y-2">
          <h2 className="font-semibold">Password</h2>
          <p className="text-sm text-muted">Sign in on any device with your email and this password. You stay signed in until you sign out.</p>
          <PasswordForm />
        </section>
      )}

      <section className="space-y-2">
        <h2 className="font-semibold">Install on your phone</h2>
        <p className="text-sm text-muted">
          Open this site on your phone. On iPhone use Safari: Share, then Add to Home Screen. On Android use Chrome: menu, then Install app.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Backup</h2>
        <p className="text-sm text-muted">
          {items.length} items, {completions.length} ticks, {pages.length} pages.
        </p>
        <button className="btn" onClick={exportJson}>Download JSON backup</button>
      </section>
    </div>
  );
}
