import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProfitabilityClassification, ProfitabilityRecommendation } from "./rules";

export type LatestProfitabilitySnapshot = {
  campaignId: string;
  campaignName: string;
  classification: ProfitabilityClassification;
  recommendation: ProfitabilityRecommendation;
  reason: string;
  spendToDate: number;
  estimatedProfitLoss: number;
  daysBelowBreakEven: number;
  evaluatedAt: string;
};

/** Latest evaluation snapshot per campaign across the whole workspace —
 * shared by the CEO/Director/Manager dashboard widgets and the dedicated
 * Profitability & Recommendation view (Section 12). */
export async function getLatestProfitabilitySnapshots(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<LatestProfitabilitySnapshot[]> {
  const { data } = await supabase
    .from("profitability_snapshot")
    .select("campaign_id, classification, recommendation, reason, spend_to_date, estimated_profit_loss, days_below_break_even, evaluated_at, campaign(name)")
    .eq("workspace_id", workspaceId)
    .order("evaluated_at", { ascending: false });

  const seen = new Set<string>();
  const result: LatestProfitabilitySnapshot[] = [];

  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const campaignId = row.campaign_id as string;
    if (seen.has(campaignId)) continue;
    seen.add(campaignId);

    const campaign = Array.isArray(row.campaign) ? row.campaign[0] : row.campaign;
    result.push({
      campaignId,
      campaignName: (campaign as { name?: string } | null)?.name ?? "—",
      classification: row.classification as ProfitabilityClassification,
      recommendation: row.recommendation as ProfitabilityRecommendation,
      reason: row.reason as string,
      spendToDate: Number(row.spend_to_date),
      estimatedProfitLoss: Number(row.estimated_profit_loss),
      daysBelowBreakEven: row.days_below_break_even as number,
      evaluatedAt: row.evaluated_at as string,
    });
  }

  return result;
}
