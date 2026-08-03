import type { SupabaseClient } from "@supabase/supabase-js";
import { rollupByProperty } from "@/lib/analytics/propertyRollup";
import { rollupByKey } from "@/lib/analytics/groupRollup";
import { computeEstimatedRevenue } from "@/lib/analytics/estimatedRoi";
import { computeHealthStatus } from "@/lib/campaigns/health";
import type { LeaderboardRow } from "@/components/dashboard/LeaderboardTable";
import type { AlertPanelRow } from "@/components/dashboard/AlertPanel";
import type { WorkspaceTrendPoint } from "@/components/dashboard/WorkspaceTrendChart";

export type CampaignForDashboard = {
  id: string;
  status: string | null;
  adAccountName: string;
  propertyId: string | null;
  propertyName: string | null;
  city: string | null;
};

export type DashboardMetricsEntry = {
  totalSpend: number;
  totalImpressions: number;
  totalLeads: number;
  latestCtr: number | null;
  latestFrequency: number | null;
};

export type DashboardData = {
  campaigns: CampaignForDashboard[];
  metricsToday: Map<string, DashboardMetricsEntry>;
  metricsYesterday: Map<string, DashboardMetricsEntry>;
  /** Metrics for whichever range the dashboard's date-range picker is set
   * to (default Last 30 Days) — drives the trend chart, leaderboards,
   * decision panel, and spend donut. Kept separate from metricsToday/
   * metricsYesterday, which stay fixed regardless of the picker (Section
   * 9.1's "Today vs Yesterday delta on headline KPIs" is a specific,
   * always-on requirement, not something a date filter should change). */
  metricsRange: Map<string, DashboardMetricsEntry>;
  rangeLabel: string;
  trend: WorkspaceTrendPoint[];
  alerts: AlertPanelRow[];
  properties: { id: string; name: string; assumedConversionRate: number | null; assumedAvgDealValue: number | null }[];
};

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function toMetricsMap(rows: Record<string, unknown>[] | null): Map<string, DashboardMetricsEntry> {
  return new Map(
    (rows ?? []).map((m) => [
      m.campaign_id as string,
      {
        totalSpend: Number(m.total_spend ?? 0),
        totalImpressions: Number(m.total_impressions ?? 0),
        totalLeads: Number(m.total_leads ?? 0),
        latestCtr: m.latest_ctr != null ? Number(m.latest_ctr) : null,
        latestFrequency: m.latest_frequency != null ? Number(m.latest_frequency) : null,
      },
    ])
  );
}

export async function loadDashboardData(
  supabase: SupabaseClient,
  workspaceId: string,
  range: { since: string; until: string; label: string }
): Promise<DashboardData> {
  const today = isoDaysAgo(0);
  const yesterday = isoDaysAgo(1);

  const [
    { data: campaignRows },
    { data: todayRows },
    { data: yesterdayRows },
    { data: rangeRows },
    { data: trendRows },
    { data: alertRows },
    { data: propertyRows },
  ] = await Promise.all([
    supabase
      .from("campaign")
      .select("id, status, city, ad_account(name), property_id, property(name, city)")
      .eq("workspace_id", workspaceId),
    supabase.rpc("campaign_metrics_summary", { p_workspace_id: workspaceId, p_since: today, p_until: today }),
    supabase.rpc("campaign_metrics_summary", { p_workspace_id: workspaceId, p_since: yesterday, p_until: yesterday }),
    supabase.rpc("campaign_metrics_summary", { p_workspace_id: workspaceId, p_since: range.since, p_until: range.until }),
    supabase.rpc("workspace_daily_trend", { p_workspace_id: workspaceId, p_since: range.since, p_until: range.until }),
    supabase
      .from("alert")
      .select("id, rule_key, severity, triggered_at, campaign(name), ad_account(name)")
      .eq("workspace_id", workspaceId)
      .in("status", ["open", "acknowledged"])
      .order("triggered_at", { ascending: false })
      .limit(20),
    supabase
      .from("property")
      .select("id, name, assumed_conversion_rate, assumed_avg_deal_value")
      .eq("workspace_id", workspaceId),
  ]);

  const campaigns: CampaignForDashboard[] = (campaignRows ?? []).map((c: Record<string, unknown>) => {
    const adAccount = Array.isArray(c.ad_account) ? c.ad_account[0] : c.ad_account;
    const property = Array.isArray(c.property) ? c.property[0] : c.property;
    return {
      id: c.id as string,
      status: c.status as string | null,
      adAccountName: (adAccount as { name?: string } | null)?.name ?? "—",
      propertyId: c.property_id as string | null,
      propertyName: (property as { name?: string } | null)?.name ?? null,
      // City is an independent campaign-level tag (PRD v4 Section 9.2), not
      // derived from Property — but falls back to the property's city if
      // the campaign wasn't explicitly city-tagged, so older/partially
      // tagged data still rolls up somewhere useful.
      city: (c.city as string | null) ?? (property as { city?: string } | null)?.city ?? null,
    };
  });

  const alerts: AlertPanelRow[] = (alertRows ?? []).map((a: Record<string, unknown>) => {
    const campaign = Array.isArray(a.campaign) ? a.campaign[0] : a.campaign;
    const adAccount = Array.isArray(a.ad_account) ? a.ad_account[0] : a.ad_account;
    return {
      id: a.id as string,
      ruleKey: a.rule_key as string,
      severity: a.severity as string,
      name: (campaign as { name?: string } | null)?.name ?? (adAccount as { name?: string } | null)?.name ?? "—",
      triggeredAt: a.triggered_at as string,
    };
  });

  return {
    campaigns,
    metricsToday: toMetricsMap(todayRows),
    metricsYesterday: toMetricsMap(yesterdayRows),
    metricsRange: toMetricsMap(rangeRows),
    rangeLabel: range.label,
    trend: (trendRows ?? []).map((r: Record<string, unknown>) => ({
      date: (r.date as string).slice(5),
      spend: Number(r.total_spend ?? 0),
      leads: Number(r.total_leads ?? 0),
    })),
    alerts,
    properties: (propertyRows ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      assumedConversionRate: p.assumed_conversion_rate,
      assumedAvgDealValue: p.assumed_avg_deal_value,
    })),
  };
}

/** Sums Estimated Revenue (Section 5.1) across every property with
 * assumptions configured — properties without them are simply excluded
 * from the total rather than treated as zero, so an incomplete rollout of
 * assumptions doesn't silently understate the workspace total. */
export function totalEstimatedRevenue(data: DashboardData): number | null {
  const rollup = propertyLeaderboardRaw(data);
  const propertyById = new Map(data.properties.map((p) => [p.id, p]));

  let total = 0;
  let anyConfigured = false;
  for (const r of rollup) {
    const prop = propertyById.get(r.propertyId!);
    const revenue = computeEstimatedRevenue(r.leads, prop?.assumedConversionRate ?? null, prop?.assumedAvgDealValue ?? null);
    if (revenue != null) {
      total += revenue;
      anyConfigured = true;
    }
  }
  return anyConfigured ? total : null;
}

function propertyLeaderboardRaw(data: DashboardData) {
  return rollupByProperty(
    data.campaigns.map((c) => ({ id: c.id, propertyId: c.propertyId })),
    data.metricsRange
  ).filter((r) => r.propertyId);
}

export function sumMetrics(campaignIds: string[], metrics: DashboardData["metricsToday"]) {
  return campaignIds.reduce(
    (acc, id) => {
      const m = metrics.get(id);
      if (!m) return acc;
      return { spend: acc.spend + m.totalSpend, leads: acc.leads + m.totalLeads, impressions: acc.impressions + m.totalImpressions };
    },
    { spend: 0, leads: 0, impressions: 0 }
  );
}

export function propertyLeaderboard(data: DashboardData): LeaderboardRow[] {
  const propertyNameById = new Map(data.campaigns.filter((c) => c.propertyId).map((c) => [c.propertyId!, c.propertyName!]));
  return rollupByProperty(
    data.campaigns.map((c) => ({ id: c.id, propertyId: c.propertyId })),
    data.metricsRange
  )
    .filter((r) => r.propertyId)
    .map((r) => ({
      key: r.propertyId!,
      name: propertyNameById.get(r.propertyId!) ?? "Unknown",
      spend: r.spend,
      leads: r.leads,
      cpl: r.cpl,
    }));
}

export function cityLeaderboard(data: DashboardData): LeaderboardRow[] {
  return rollupByKey(
    data.campaigns.map((c) => ({ id: c.id, key: c.city ?? "Unknown" })),
    data.metricsRange
  ).map((r) => ({ key: r.key, name: r.key, spend: r.spend, leads: r.leads, cpl: r.cpl }));
}

/** Section 11.3 Manager Dashboard: "Campaigns needing attention
 * (Red/Amber)" — reuses the same health heuristic as Campaign Monitoring
 * (lib/campaigns/health.ts) rather than a second, dashboard-specific one. */
export function campaignsNeedingAttention(
  data: DashboardData
): { id: string; name: string; adAccountName: string; health: "amber" | "red" }[] {
  return data.campaigns
    .map((c) => {
      const m = data.metricsToday.get(c.id);
      const health = computeHealthStatus({
        status: c.status,
        ctr: m?.latestCtr ?? null,
        frequency: m?.latestFrequency ?? null,
        spend: m?.totalSpend ?? 0,
        impressions: m?.totalImpressions ?? 0,
        leads: m?.totalLeads ?? 0,
      });
      return { id: c.id, name: c.propertyName ?? c.adAccountName, adAccountName: c.adAccountName, health };
    })
    .filter((c): c is { id: string; name: string; adAccountName: string; health: "amber" | "red" } => c.health === "amber" || c.health === "red");
}
