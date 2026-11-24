import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

// Returns null when Supabase isn't configured; the app then runs locally only.
export function supabase() {
  if (!url || !key) return null;
  client ??= createClient(url, key);
  return client;
}
