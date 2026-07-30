import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchCampaigns, fetchInsights, extractLeadCount, MetaApiError } from "./client";

type AdAccountRow = {
  id: string;
  workspace_id: string;
  business_manager_id: string;
  meta_ad_account_id: string;
};

export type SyncResult = {
  adAccountId: string;
  status: "success" | "error";
  campaignsSynced: number;
  metricsRowsSynced: number;
  error?: string;
};

/**
 * Syncs one Ad Account: pulls campaigns + the last N days of insights from
 * the Meta Marketing API and upserts them into the schema. Must be called
 * with an admin (service-role) client — it writes across whatever workspace
 * owns the ad account, which is legitimate for a server-side sync job but
 * would violate RLS for a normal user session (by design).
 */
export async function syncAdAccount(
  admin: SupabaseClient,
  adAccount: AdAccountRow,
  daysBack = 2
): Promise<SyncResult> {
  const { data: logRow } = await admin
    .from("sync_log")
    .insert({
      workspace_id: adAccount.workspace_id,
      ad_account_id: adAccount.id,
      status: "running",
    })
    .select("id")
    .single();

  try {
    const { data: bm } = await admin
      .from("business_manager")
      .select("system_user_token_secret_ref")
      .eq("id", adAccount.business_manager_id)
      .single();

    if (!bm?.system_user_token_secret_ref) {
      throw new Error("No Meta System User token configured for this ad account's Business Manager");
    }

    const { data: token, error: tokenErr } = await admin.rpc("get_meta_token", {
      secret_id: bm.system_user_token_secret_ref,
    });
    if (tokenErr || !token) {
      throw new Error(`Failed to decrypt Meta token: ${tokenErr?.message ?? "not found"}`);
    }

    const metaCampaigns = await fetchCampaigns(adAccount.meta_ad_account_id, token);

    for (const c of metaCampaigns) {
      await admin
        .from("campaign")
        .upsert(
          {
            workspace_id: adAccount.workspace_id,
            ad_account_id: adAccount.id,
            meta_campaign_id: c.id,
            name: c.name,
            objective: c.objective ?? null,
            status: c.status ?? null,
            buying_type: c.buying_type ?? null,
          },
          { onConflict: "workspace_id,meta_campaign_id" }
        );
    }

    const { data: campaignRows } = await admin
      .from("campaign")
      .select("id, meta_campaign_id")
      .eq("ad_account_id", adAccount.id);
    const campaignIdByMetaId = new Map((campaignRows ?? []).map((r) => [r.meta_campaign_id, r.id]));

    const until = new Date().toISOString().slice(0, 10);
    const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const insights = await fetchInsights(adAccount.meta_ad_account_id, token, since, until);

    let metricsRowsSynced = 0;
    for (const row of insights) {
      const campaignId = campaignIdByMetaId.get(row.campaign_id);
      if (!campaignId) continue; // campaign not in our table yet (shouldn't happen post-sync-above, but don't crash the job)

      const spend = parseFloat(row.spend ?? "0");
      const leads = extractLeadCount(row.actions);

      await admin.from("daily_metrics").upsert(
        {
          workspace_id: adAccount.workspace_id,
          campaign_id: campaignId,
          date: row.date_start,
          spend,
          impressions: parseInt(row.impressions ?? "0", 10),
          reach: parseInt(row.reach ?? "0", 10),
          frequency: row.frequency ? parseFloat(row.frequency) : null,
          cpm: row.cpm ? parseFloat(row.cpm) : null,
          ctr: row.ctr ? parseFloat(row.ctr) : null,
          unique_ctr: row.unique_ctr ? parseFloat(row.unique_ctr) : null,
          cpc: row.cpc ? parseFloat(row.cpc) : null,
          leads,
          cpl: leads > 0 ? spend / leads : null,
        },
        { onConflict: "workspace_id,campaign_id,date" }
      );
      metricsRowsSynced++;
    }

    await admin
      .from("ad_account")
      .update({ last_synced_at: new Date().toISOString(), last_sync_status: "success", last_sync_error: null })
      .eq("id", adAccount.id);

    if (logRow) {
      await admin
        .from("sync_log")
        .update({
          finished_at: new Date().toISOString(),
          status: "success",
          campaigns_synced: metaCampaigns.length,
          metrics_rows_synced: metricsRowsSynced,
        })
        .eq("id", logRow.id);
    }

    return {
      adAccountId: adAccount.id,
      status: "success",
      campaignsSynced: metaCampaigns.length,
      metricsRowsSynced,
    };
  } catch (e) {
    const message = e instanceof MetaApiError ? `Meta API error: ${e.message}` : e instanceof Error ? e.message : "Unknown sync error";

    await admin
      .from("ad_account")
      .update({ last_sync_status: "error", last_sync_error: message })
      .eq("id", adAccount.id);

    if (logRow) {
      await admin
        .from("sync_log")
        .update({ finished_at: new Date().toISOString(), status: "error", error_message: message })
        .eq("id", logRow.id);
    }

    return { adAccountId: adAccount.id, status: "error", campaignsSynced: 0, metricsRowsSynced: 0, error: message };
  }
}
