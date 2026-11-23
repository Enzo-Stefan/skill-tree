import type { SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** False when the keys aren't set. The app then runs without accounts. */
export const accountsConfigured = Boolean(url && anonKey);

let client: Promise<SupabaseClient | null> | null = null;

/**
 * The shared Supabase client, or null when accounts aren't set up. The library is
 * only downloaded the first time this is called, so players who never sign in don't pay for it.
 */
export function loadSupabase(): Promise<SupabaseClient | null> {
  if (!url || !anonKey) return Promise.resolve(null);
  client ??= import("@supabase/supabase-js").then(({ createClient }) => createClient(url, anonKey));
  // Don't cache a failed download, so the next call can try again.
  client.catch(() => {
    client = null;
  });
  return client;
}

/**
 * True when this page load may already hold a session: Supabase keeps it in
 * localStorage as `sb-<project>-auth-token`, and Google sends the player back with
 * `?code=` or `#access_token=` in the address. Only then is the library needed at startup.
 */
export function mayHaveSession(): boolean {
  if (!accountsConfigured) return false;
  if (window.location.search.includes("code=") || window.location.hash.includes("access_token")) return true;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("sb-") && key.endsWith("-auth-token")) return true;
    }
  } catch {
    // Storage can be blocked. Then there is no saved session to restore.
  }
  return false;
}
