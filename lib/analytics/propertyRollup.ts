export type CampaignMetrics = { totalSpend: number; totalImpressions: number; totalLeads: number };

export type PropertyRollup = {
  propertyId: string | null; // null = untagged
  spend: number;
  impressions: number;
  leads: number;
  cpl: number | null;
};

/**
 * Rolls campaign-level metrics up to the property level (PRD Section 9.5) —
 * "the unit real estate leadership actually thinks in." Pure function so
 * it's testable without a database; the Property Analytics page does the
 * DB fetch and calls this to aggregate.
 */
export function rollupByProperty(
  campaigns: { id: string; propertyId: string | null }[],
  metricsByCampaign: Map<string, CampaignMetrics>
): PropertyRollup[] {
  const byProperty = new Map<string | null, { spend: number; impressions: number; leads: number }>();

  for (const c of campaigns) {
    const m = metricsByCampaign.get(c.id);
    if (!m) continue;

    const existing = byProperty.get(c.propertyId) ?? { spend: 0, impressions: 0, leads: 0 };
    byProperty.set(c.propertyId, {
      spend: existing.spend + m.totalSpend,
      impressions: existing.impressions + m.totalImpressions,
      leads: existing.leads + m.totalLeads,
    });
  }

  return [...byProperty.entries()].map(([propertyId, agg]) => ({
    propertyId,
    spend: agg.spend,
    impressions: agg.impressions,
    leads: agg.leads,
    cpl: agg.leads > 0 ? agg.spend / agg.leads : null,
  }));
}
