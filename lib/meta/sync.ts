import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchCampaigns, fetchInsights, extractLeadCount, MetaApiError } from "./client";
import { evaluateAndCreateAlerts } from "@/lib/alerts/evaluate";

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

    // Capture pre-sync status so the alert engine can detect an
    // Active→Paused transition (Section 17 "Campaign stopped unexpectedly")
    // — this would be indistinguishable from a normal paused campaign once
    // the upsert below overwrites it.
    const { data: preSyncCampaignRows } = await admin
      .from("campaign")
      .select("meta_campaign_id, status")
      .eq("ad_account_id", adAccount.id);
    const previousStatusByMetaId = new Map((preSyncCampaignRows ?? []).map((r) => [r.meta_campaign_id, r.status]));

    // Meta returns budget fields in the account's currency's minor unit
    // (e.g. paise/cents) — divide by 100. See the caveat on MetaCampaign in
    // lib/meta/client.ts; not yet visually reconciled against Ads Manager.
    const minorToMajor = (v?: string) => (v != null ? parseFloat(v) / 100 : null);

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
            effective_status: c.effective_status ?? null,
            buying_type: c.buying_type ?? null,
            daily_budget: minorToMajor(c.daily_budget),
            lifetime_budget: minorToMajor(c.lifetime_budget),
            budget_remaining: minorToMajor(c.budget_remaining),
            budget_synced_at: new Date().toISOString(),
          },
          { onConflict: "workspace_id,meta_campaign_id" }
        );
    }

    const { data: campaignRows } = await admin
      .from("campaign")
      .select("id, meta_campaign_id, status, effective_status, daily_budget, lifetime_budget, budget_remaining")
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
          clicks: row.clicks ? parseInt(row.clicks, 10) : null,
          leads,
          cpl: leads > 0 ? spend / leads : null,
        },
        { onConflict: "workspace_id,campaign_id,date" }
      );
      metricsRowsSynced++;
    }

    // Alert evaluation (Section 17): fetch the last 8 days in one batched
    // query across every campaign on this ad account, rather than one query
    // per campaign — the difference between ~2 queries and ~1,800 for a
    // 900-campaign account.
    const historySince = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { data: historyRows } = await admin
      .from("daily_metrics")
      .select("campaign_id, date, spend, leads, ctr, cpl, frequency")
      .eq("workspace_id", adAccount.workspace_id)
      .in("campaign_id", [...campaignIdByMetaId.values()])
      .gte("date", historySince);

    const historyByCampaign = new Map<string, { date: string; spend: number; leads: number; ctr: number | null; cpl: number | null; frequency: number | null }[]>();
    for (const row of historyRows ?? []) {
      const list = historyByCampaign.get(row.campaign_id) ?? [];
      list.push({
        date: row.date,
        spend: Number(row.spend),
        leads: Number(row.leads),
        ctr: row.ctr != null ? Number(row.ctr) : null,
        cpl: row.cpl != null ? Number(row.cpl) : null,
        frequency: row.frequency != null ? Number(row.frequency) : null,
      });
      historyByCampaign.set(row.campaign_id, list);
    }

    const campaignsForAlerts = (campaignRows ?? []).map((r) => ({
      id: r.id,
      status: r.status,
      effectiveStatus: r.effective_status,
      dailyBudget: r.daily_budget != null ? Number(r.daily_budget) : null,
      lifetimeBudget: r.lifetime_budget != null ? Number(r.lifetime_budget) : null,
      budgetRemaining: r.budget_remaining != null ? Number(r.budget_remaining) : null,
      previousStatus: previousStatusByMetaId.get(r.meta_campaign_id) ?? null,
    }));

    await evaluateAndCreateAlerts(admin, adAccount.workspace_id, adAccount.id, campaignsForAlerts, historyByCampaign);

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

    // Section 17 "Sync/API failure" alert (Admin-only in the PRD's channel
    // table — no channel differentiation yet since delivery is in-app only,
    // Sprint 9 handles per-role routing). Deduped like the campaign rules.
    const { data: existingSyncFailureAlert } = await admin
      .from("alert")
      .select("id")
      .eq("workspace_id", adAccount.workspace_id)
      .eq("ad_account_id", adAccount.id)
      .eq("rule_key", "sync_failure")
      .in("status", ["open", "acknowledged"])
      .maybeSingle();

    if (!existingSyncFailureAlert) {
      await admin.from("alert").insert({
        workspace_id: adAccount.workspace_id,
        ad_account_id: adAccount.id,
        rule_key: "sync_failure",
        severity: "red",
      });
    }

    if (logRow) {
      await admin
        .from("sync_log")
        .update({ finished_at: new Date().toISOString(), status: "error", error_message: message })
        .eq("id", logRow.id);
    }

    return { adAccountId: adAccount.id, status: "error", campaignsSynced: 0, metricsRowsSynced: 0, error: message };
  }
}
