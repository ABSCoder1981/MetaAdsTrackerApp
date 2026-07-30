import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — bypasses RLS entirely. Server-only: never
 * import this from a Client Component or expose SUPABASE_SERVICE_ROLE_KEY to
 * the browser. Used by the Meta sync job (docs/ARCHITECTURE.md §4), which
 * legitimately needs to read/write across every workspace.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
