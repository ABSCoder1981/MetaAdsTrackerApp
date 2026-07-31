import type { SupabaseClient } from "@supabase/supabase-js";
import {
  checkCtrBelowThreshold,
  checkCplIncreased,
  checkBudgetExhausted,
  checkCampaignStoppedUnexpectedly,
  checkFrequencyHigh,
  checkSpendAnomaly,
  checkLeadVolumeDropped,
  checkCampaignRejected,
  DEFAULT_ALERT_THRESHOLDS,
} from "./rules";

type CampaignForAlerts = {
  id: string;
  status: string | null;
  effectiveStatus: string | null;
  dailyBudget: number | null;
  lifetimeBudget: number | null;
  budgetRemaining: number | null;
  previousStatus: string | null;
};

type MetricsDay = { date: string; spend: number; leads: number; ctr: number | null; cpl: number | null; frequency: number | null };

const RULE_SEVERITY: Record<string, "amber" | "red"> = {
  ctr_below_threshold: "amber",
  cpl_increased: "amber",
  budget_exhausted: "red",
  campaign_stopped_unexpectedly: "red",
  frequency_high: "amber",
  spend_anomaly: "red",
  lead_volume_dropped: "amber",
  campaign_rejected: "red",
};

function average(values: (number | null)[]): number {
  const nums = values.filter((v): v is number => v != null);
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/**
 * Evaluates the 8 implemented alert rules (see lib/alerts/rules.ts's
 * file-level note for the 4 deferred ones) for every campaign on an ad
 * account in one batch, and inserts new `alert` rows — skipping any rule
 * that already has an open alert for that campaign, to avoid duplicate
 * spam on every sync run. Does not auto-resolve when a condition clears;
 * that's manual via the Alerts Centre (documented MVP simplification).
 */
export async function evaluateAndCreateAlerts(
  admin: SupabaseClient,
  workspaceId: string,
  adAccountId: string,
  campaigns: CampaignForAlerts[],
  metricsHistoryByCampaign: Map<string, MetricsDay[]>
): Promise<number> {
  const { data: workspaceRow } = await admin.from("workspace").select("alert_thresholds").eq("id", workspaceId).single();
  const thresholds = { ...DEFAULT_ALERT_THRESHOLDS, ...(workspaceRow?.alert_thresholds ?? {}) };

  const campaignIds = campaigns.map((c) => c.id);
  const { data: openAlerts } = await admin
    .from("alert")
    .select("campaign_id, rule_key")
    .eq("workspace_id", workspaceId)
    .in("campaign_id", campaignIds)
    .in("status", ["open", "acknowledged"]);

  const alreadyOpen = new Set((openAlerts ?? []).map((a) => `${a.campaign_id}:${a.rule_key}`));

  const toInsert: { workspace_id: string; ad_account_id: string; campaign_id: string; rule_key: string; severity: string }[] = [];

  for (const c of campaigns) {
    const history = (metricsHistoryByCampaign.get(c.id) ?? []).sort((a, b) => a.date.localeCompare(b.date));
    const latest = history.at(-1);
    const trailing = history.slice(0, -1);

    const firedRules: string[] = [];

    if (checkCtrBelowThreshold(history.map((h) => h.ctr), thresholds.ctrMinPct)) firedRules.push("ctr_below_threshold");
    if (checkCplIncreased(latest?.cpl ?? null, average(trailing.map((h) => h.cpl)) || null, thresholds.cplIncreasePct))
      firedRules.push("cpl_increased");
    if (checkBudgetExhausted(c.budgetRemaining, c.lifetimeBudget)) firedRules.push("budget_exhausted");
    if (checkCampaignStoppedUnexpectedly(c.previousStatus, c.status)) firedRules.push("campaign_stopped_unexpectedly");
    if (checkFrequencyHigh(latest?.frequency ?? null, thresholds.frequencyMax)) firedRules.push("frequency_high");
    if (latest && checkSpendAnomaly(latest.spend, average(trailing.map((h) => h.spend)), thresholds.spendAnomalyPct))
      firedRules.push("spend_anomaly");
    if (latest && checkLeadVolumeDropped(latest.leads, average(trailing.map((h) => h.leads)), thresholds.leadDropPct))
      firedRules.push("lead_volume_dropped");
    if (checkCampaignRejected(c.effectiveStatus)) firedRules.push("campaign_rejected");

    for (const ruleKey of firedRules) {
      if (alreadyOpen.has(`${c.id}:${ruleKey}`)) continue;
      toInsert.push({
        workspace_id: workspaceId,
        ad_account_id: adAccountId,
        campaign_id: c.id,
        rule_key: ruleKey,
        severity: RULE_SEVERITY[ruleKey],
      });
    }
  }

  if (toInsert.length > 0) {
    await admin.from("alert").insert(toInsert);
  }

  return toInsert.length;
}
