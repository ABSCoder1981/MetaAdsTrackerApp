import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client. Session is workspace-scoped once a user
 * signs in (see Section 9.16 / ARCHITECTURE.md §2 for the multi-tenancy model).
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
