"use client";

import { useStore } from "@/lib/store";
import { supabaseBrowser, supabaseConfigured } from "@/lib/supabase/client";

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
