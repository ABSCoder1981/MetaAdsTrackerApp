export type CampaignMetrics = { totalSpend: number; totalImpressions: number; totalLeads: number };

export type GroupRollup<K> = {
  key: K;
  spend: number;
  impressions: number;
  leads: number;
  cpl: number | null;
};

/**
 * Generic version of lib/analytics/propertyRollup.ts's grouping logic, for
 * dashboard widgets that roll campaigns up by city, manager, or any other
 * dimension rather than just property. propertyRollup.ts is left as its own
 * (already-tested, already-shipped) module rather than rewritten on top of
 * this — this is for new call sites (Section 11.2's City/Manager
 * leaderboards), not a refactor of working code.
 */
export function rollupByKey<K>(
  campaigns: { id: string; key: K }[],
  metricsByCampaign: Map<string, CampaignMetrics>
): GroupRollup<K>[] {
  const byKey = new Map<K, { spend: number; impressions: number; leads: number }>();

  for (const c of campaigns) {
    const m = metricsByCampaign.get(c.id);
    if (!m) continue;

    const existing = byKey.get(c.key) ?? { spend: 0, impressions: 0, leads: 0 };
    byKey.set(c.key, {
      spend: existing.spend + m.totalSpend,
      impressions: existing.impressions + m.totalImpressions,
      leads: existing.leads + m.totalLeads,
    });
  }

  return [...byKey.entries()].map(([key, agg]) => ({
    key,
    spend: agg.spend,
    impressions: agg.impressions,
    leads: agg.leads,
    cpl: agg.leads > 0 ? agg.spend / agg.leads : null,
  }));
}
