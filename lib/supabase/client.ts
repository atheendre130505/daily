import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BASE } from "../base";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let client: SupabaseClient | null = null;

export function supabaseBrowser(): SupabaseClient {
  if (!supabaseConfigured) throw new Error("Supabase is not configured (.env.local)");
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}

/**
 * Email sign-in, step 1: Supabase emails a one-time code (and a link). The first sign-in creates the account;
 * after that, turn off "Allow new users to sign up" in Supabase so nobody else can create one (see SETUP.md).
 */
export async function sendEmailCode(email: string): Promise<void> {
  const { error } = await supabaseBrowser().auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: `${window.location.origin}${BASE}/today/` },
  });
  if (error) throw error;
}

/** Email sign-in, step 2: the code typed in the app. Works inside the installed phone app, unlike the link. */
export async function verifyEmailCode(email: string, code: string): Promise<void> {
  const { error } = await supabaseBrowser().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
  if (error) throw error;
}
