import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncAdAccount } from "@/lib/meta/sync";

export const maxDuration = 60;

/**
 * Daily scheduled sync (PRD Section 9.14). Triggered by Vercel Cron
 * (vercel.json) with an `Authorization: Bearer $CRON_SECRET` header — see
 * https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs.
 * Syncs every connected ad account across every workspace.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: adAccounts, error } = await admin
    .from("ad_account")
    .select("id, workspace_id, business_manager_id, meta_ad_account_id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = [];
  for (const account of adAccounts ?? []) {
    results.push(await syncAdAccount(admin, account));
  }

  return NextResponse.json({ synced: results.length, results });
}
