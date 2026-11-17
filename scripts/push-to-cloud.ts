// Moves everything from the PC version of Daily (a backup file from Settings → "Download JSON backup")
// into your Supabase account: habits, events, ticks, pages, and the images you pasted into notes.
// Safe to re-run: existing rows are updated, nothing is duplicated.
//
// Usage: npx tsx --env-file=.env.local scripts/push-to-cloud.ts <backup.json> <your-google-email>
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local, and that you've signed in once.
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const [file, email] = process.argv.slice(2);
if (!file) throw new Error("Usage: npx tsx --env-file=.env.local scripts/push-to-cloud.ts <backup.json> [email]");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

type Row = Record<string, unknown>;
const backup = JSON.parse(readFileSync(file, "utf8")) as { items: Row[]; completions: Row[]; pages: Row[] };

async function main() {
  const { data: users, error } = await sb.auth.admin.listUsers();
  if (error) throw error;
  // with no email given, use the only account (it's a one-person app)
  const user = email
    ? users.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    : users.users.length === 1
      ? users.users[0]
      : undefined;
  if (!user) throw new Error(email ? "No account for that email yet: sign in to the app once, then re-run." : `Expected exactly one account, found ${users.users.length}. Pass the email.`);
  const user_id = user.id;

  // 1. Images: pasted ones (/api/files/…) and Notion ones (/notion-images/…) move to Supabase Storage
  const urlMap = new Map<string, string>();
  const json = JSON.stringify(backup.pages);
  for (const m of json.matchAll(/\/(api\/files|notion-images)\/([0-9a-f-]{36}\.[a-z0-9]+)/g)) {
    const [ref, kind, name] = [m[0], m[1], m[2]];
    if (urlMap.has(ref)) continue;
    const local = kind === "api/files" ? path.join("uploads", name) : path.join("public", "notion-images", name);
    if (!existsSync(local)) {
      console.warn("missing image, skipped:", local);
      continue;
    }
    const dest = `${user_id}/${name}`;
    const ext = name.split(".").pop()!;
    const type = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`;
    const { error: ue } = await sb.storage.from("images").upload(dest, readFileSync(local), { contentType: type, upsert: true });
    if (ue) throw ue;
    urlMap.set(ref, sb.storage.from("images").getPublicUrl(dest).data.publicUrl);
  }
  const fixUrls = (v: unknown) => {
    let s = JSON.stringify(v);
    for (const [from, to] of urlMap) s = s.split(from).join(to);
    return JSON.parse(s);
  };

  // 2. Items (habits + events). Tasks were removed from the app, so they're skipped.
  const items: Row[] = backup.items.filter((i) => i.type !== "task").map(({ updated_at: _u, ...i }) => ({ ...i, user_id }));
  if (items.length) {
    const { error: ie } = await sb.from("items").upsert(items);
    if (ie) throw ie;
  }

  // 3. Pages: parents first so the parent link is valid
  const pages = backup.pages.map(({ updated_at: _u, search: _s, ...p }) => ({ ...fixUrls(p), user_id })) as Row[];
  const byId = new Map(pages.map((p) => [p.id, p]));
  const depth = (p: Row): number => (p.parent_id && byId.has(p.parent_id as string) ? 1 + depth(byId.get(p.parent_id as string)!) : 0);
  pages.sort((a, b) => depth(a) - depth(b));
  for (const p of pages) {
    const { error: pe } = await sb.from("pages").upsert(p);
    if (pe) throw pe;
  }

  // 4. Ticks (the "only today" lock doesn't apply to this admin import)
  const known = new Set(items.map((i) => i.id));
  const ticks = backup.completions.filter((c) => known.has(c.item_id)).map(({ updated_at: _u, ...c }) => ({ ...c, user_id }));
  for (let i = 0; i < ticks.length; i += 500) {
    const { error: ce } = await sb.from("completions").upsert(ticks.slice(i, i + 500), { onConflict: "item_id,date" });
    if (ce) throw ce;
  }

  console.log(`Moved ${items.length} habits/events, ${ticks.length} ticks, ${pages.length} pages, ${urlMap.size} images.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
