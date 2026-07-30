import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncAdAccount } from "@/lib/meta/sync";

export const maxDuration = 60;

/**
 * On-demand manual refresh (PRD Section 9.14). Auth'd via the normal
 * session — RLS on the `ad_account` select naturally scopes this to ad
 * accounts the caller's workspace(s) actually own, so a user can't trigger a
 * sync for an ad account outside their access. The actual sync then runs
 * with the admin client (same as the cron job) since it needs to write
 * campaign/metrics data server-side.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ adAccountId: string }> }) {
  const { adAccountId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: adAccount, error } = await supabase
    .from("ad_account")
    .select("id, workspace_id, business_manager_id, meta_ad_account_id")
    .eq("id", adAccountId)
    .single();

  if (error || !adAccount) {
    return NextResponse.json({ error: "Ad account not found or not accessible" }, { status: 404 });
  }

  const admin = createAdminClient();
  const result = await syncAdAccount(admin, adAccount);

  return NextResponse.json(result);
}
