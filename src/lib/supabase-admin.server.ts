import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient<any, "public", any> | null = null;

export function getSupabaseAdmin(): SupabaseClient<any, "public", any> {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.PENTEST_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing SUPABASE_URL or PENTEST_SUPABASE_SERVICE_ROLE_KEY. Set the service role key in Project Secrets.",
    );
  }
  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
