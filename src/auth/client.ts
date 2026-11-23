import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** The shared Supabase client, or null when the keys aren't set (the app then runs without accounts). */
export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null;
