import { createBrowserClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { BASE } from "../base";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const STORAGE_KEY = "daily-auth";
let client: SupabaseClient | null = null;

/**
 * The sign-in is kept in this app's own storage (not a cookie) and renewed automatically, so it lasts until you
 * sign out. Cookies set by a web page are wiped after 7 days on iPhone browsers; installed apps' storage isn't.
 */
export function supabaseBrowser(): SupabaseClient {
  if (!supabaseConfigured) throw new Error("Supabase is not configured");
  client ??= createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storageKey: STORAGE_KEY,
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  });
  return client;
}

/**
 * One-time move from the old cookie-based sign-in, so a device that's already signed in stays signed in.
 * Returns true if a session was carried over.
 */
export async function migrateCookieSession(): Promise<boolean> {
  try {
    if (localStorage.getItem(STORAGE_KEY)) return false;
    if (!document.cookie.includes("sb-")) return false;
    const old = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data } = await old.auth.getSession();
    if (!data.session) return false;
    const { error } = await supabaseBrowser().auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
    if (error) return false;
    // clear the old cookies so there's one source of truth
    document.cookie.split(";").map((c) => c.trim().split("=")[0]).filter((n) => n.startsWith("sb-")).forEach((n) => (document.cookie = `${n}=; Max-Age=0; path=/`));
    return true;
  } catch {
    return false;
  }
}

/** Sign in with email + password (no email is sent). */
export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await supabaseBrowser().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(error.message === "Invalid login credentials" ? "Wrong email or password." : error.message);
}

/** Set or change the password for the signed-in account. */
export async function setPassword(password: string): Promise<void> {
  const { error } = await supabaseBrowser().auth.updateUser({ password });
  if (error) throw error;
}

/** Backup sign-in, step 1: email a one-time code (only arrives if the email template includes {{ .Token }}). */
export async function sendEmailCode(email: string): Promise<void> {
  const { error } = await supabaseBrowser().auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: `${window.location.origin}${BASE}/today/`, shouldCreateUser: false },
  });
  if (error) throw error;
}

/** Backup sign-in, step 2: the code typed in the app. */
export async function verifyEmailCode(email: string, code: string): Promise<void> {
  const { error } = await supabaseBrowser().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
  if (error) throw error;
}
