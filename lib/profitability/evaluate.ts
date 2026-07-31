import type { SupabaseClient } from "@supabase/supabase-js";
import {
  classifyProfitability,
  computeDaysBelowBreakEven,
  computeRecommendation,
  buildProfitabilityReason,
  DEFAULT_PROFITABILITY_THRESHOLDS,
} from "./rules";
import { computeEstimatedRevenue } from "@/lib/analytics/estimatedRoi";

type CampaignForProfitability = { id: string; propertyId: string | null };

/**
 * Evaluates the Profitability Advisor (Section 9.10) for every property-
 * tagged campaign on an ad account, in one batch per sync run — same
 * batching approach as lib/alerts/evaluate.ts, for the same reason (avoid
 * N round trips for an N-campaign account). Untagged campaigns are skipped
 * entirely: there's no property assumption to compute Estimated Revenue
 * from, so no verdict is possible.
 */
export async function evaluateAndStoreProfitability(
  admin: SupabaseClient,
  workspaceId: string,
  campaigns: CampaignForProfitability[]
): Promise<void> {
  const taggedCampaigns = campaigns.filter((c) => c.propertyId);
  if (taggedCampaigns.length === 0) return;

  const { data: workspaceRow } = await admin
    .from("workspace")
    .select("profitability_thresholds")
    .eq("id", workspaceId)
    .single();
  const thresholds = { ...DEFAULT_PROFITABILITY_THRESHOLDS, ...(workspaceRow?.profitability_thresholds ?? {}) };

  const campaignIds = taggedCampaigns.map((c) => c.id);
  const propertyIds = [...new Set(taggedCampaigns.map((c) => c.propertyId!))];

  const [{ data: metricsRows }, { data: propertyRows }, { data: previousSnapshots }] = await Promise.all([
    admin.from("daily_metrics").select("campaign_id, spend, leads").in("campaign_id", campaignIds),
    admin
      .from("property")
      .select("id, assumed_conversion_rate, assumed_avg_deal_value")
      .in("id", propertyIds),
    admin
      .from("profitability_snapshot")
      .select("campaign_id, days_below_break_even, evaluated_at")
      .in("campaign_id", campaignIds)
      .order("evaluated_at", { ascending: false }),
  ]);

  const totalsByCampaign = new Map<string, { spend: number; leads: number }>();
  for (const row of metricsRows ?? []) {
    const existing = totalsByCampaign.get(row.campaign_id) ?? { spend: 0, leads: 0 };
    existing.spend += Number(row.spend);
    existing.leads += Number(row.leads);
    totalsByCampaign.set(row.campaign_id, existing);
  }

  const propertyById = new Map((propertyRows ?? []).map((p) => [p.id, p]));

  const latestPreviousByCampaign = new Map<string, number>();
  for (const snap of previousSnapshots ?? []) {
    if (!latestPreviousByCampaign.has(snap.campaign_id)) {
      latestPreviousByCampaign.set(snap.campaign_id, snap.days_below_break_even);
    }
  }

  const snapshotsToInsert: Record<string, unknown>[] = [];
  const pauseAlertCampaignIds: string[] = [];

  for (const c of taggedCampaigns) {
    const totals = totalsByCampaign.get(c.id);
    if (!totals || totals.spend < thresholds.minSpendForEligibility) continue;

    const property = propertyById.get(c.propertyId!);
    const assumedConversionRate = property?.assumed_conversion_rate ?? null;
    const assumedAvgDealValue = property?.assumed_avg_deal_value ?? null;
    const estimatedRevenue = computeEstimatedRevenue(totals.leads, assumedConversionRate, assumedAvgDealValue);
    if (estimatedRevenue == null) continue; // no assumptions configured for this property yet

    const estimatedProfitLoss = estimatedRevenue - totals.spend;
    const cpl = totals.leads > 0 ? totals.spend / totals.leads : null;
    const breakEvenCpl =
      assumedConversionRate != null && assumedAvgDealValue != null && assumedConversionRate > 0
        ? assumedAvgDealValue * (assumedConversionRate / 100)
        : null;
    const cplVsBreakEvenPct = cpl != null && breakEvenCpl ? ((cpl - breakEvenCpl) / breakEvenCpl) * 100 : null;

    const classification = classifyProfitability(estimatedProfitLoss, totals.spend, thresholds.breakEvenMarginPct);
    const isLossMakingToday = classification === "loss_making";
    const daysBelowBreakEven = computeDaysBelowBreakEven(latestPreviousByCampaign.get(c.id) ?? 0, isLossMakingToday);
    const recommendation = computeRecommendation(classification, daysBelowBreakEven, thresholds.consecutiveDayThreshold);
    const marginPct = totals.spend > 0 ? (estimatedProfitLoss / totals.spend) * 100 : 0;
    const reason = buildProfitabilityReason({
      recommendation,
      marginPct,
      daysBelowBreakEven,
      consecutiveDayThreshold: thresholds.consecutiveDayThreshold,
      breakEvenMarginPct: thresholds.breakEvenMarginPct,
      cplVsBreakEvenPct,
    });

    snapshotsToInsert.push({
      workspace_id: workspaceId,
      campaign_id: c.id,
      spend_to_date: totals.spend,
      leads_to_date: totals.leads,
      cpl,
      estimated_revenue: estimatedRevenue,
      estimated_profit_loss: estimatedProfitLoss,
      classification,
      recommendation,
      reason,
      days_below_break_even: daysBelowBreakEven,
    });

    if (recommendation === "pause") pauseAlertCampaignIds.push(c.id);
  }

  if (snapshotsToInsert.length > 0) {
    await admin.from("profitability_snapshot").insert(snapshotsToInsert);
  }

  if (pauseAlertCampaignIds.length > 0) {
    const { data: openPauseAlerts } = await admin
      .from("alert")
      .select("campaign_id")
      .eq("workspace_id", workspaceId)
      .eq("rule_key", "pause_recommended")
      .in("campaign_id", pauseAlertCampaignIds)
      .in("status", ["open", "acknowledged"]);
    const alreadyOpen = new Set((openPauseAlerts ?? []).map((a) => a.campaign_id));

    const newAlerts = pauseAlertCampaignIds
      .filter((id) => !alreadyOpen.has(id))
      .map((campaignId) => ({
        workspace_id: workspaceId,
        campaign_id: campaignId,
        rule_key: "pause_recommended",
        severity: "red",
      }));

    if (newAlerts.length > 0) {
      await admin.from("alert").insert(newAlerts);
    }
  }
}
