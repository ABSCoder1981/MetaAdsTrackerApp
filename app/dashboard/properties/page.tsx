import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveWorkspaceId } from "@/lib/workspace";
import { resolveDateRange, RANGE_OPTIONS } from "@/lib/campaigns/dateRange";
import { rollupByProperty } from "@/lib/analytics/propertyRollup";
import { computeEstimatedRevenue, computeEstimatedRoiPct } from "@/lib/analytics/estimatedRoi";
import { EstimatedValue } from "@/components/EstimatedValue";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import type { ExportColumn } from "@/lib/export/csv";
import Link from "next/link";
import { updatePropertyAssumptions, deleteProperty } from "./actions";
import { TableScroller } from "@/components/TableScroller";

type PropertyExportRow = {
  name: string;
  city: string | null;
  campaignCount: number;
  spend: number;
  leads: number;
  cpl: number | null;
  estRevenue: number | null;
  estRoiPct: number | null;
};

const PROPERTY_EXPORT_COLUMNS: ExportColumn<PropertyExportRow>[] = [
  { key: "name", label: "Property" },
  { key: "city", label: "City" },
  { key: "campaignCount", label: "Campaigns" },
  { key: "spend", label: "Spend" },
  { key: "leads", label: "Leads" },
  { key: "cpl", label: "CPL" },
  { key: "estRevenue", label: "Est. Revenue" },
  { key: "estRoiPct", label: "Est. ROI %" },
];

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; compare?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const cookieStore = await cookies();
  const workspaceId = await resolveActiveWorkspaceId(supabase, cookieStore.get("active_workspace_id")?.value);
  const { since, until } = resolveDateRange(params.range ?? "last30");

  const [{ data: campaigns }, { data: metrics }, { data: properties }] = await Promise.all([
    supabase.from("campaign").select("id, property_id").eq("workspace_id", workspaceId ?? ""),
    supabase.rpc("campaign_metrics_summary", { p_workspace_id: workspaceId, p_since: since, p_until: until }),
    supabase
      .from("property")
      .select("id, name, city, assumed_conversion_rate, assumed_avg_deal_value")
      .eq("workspace_id", workspaceId ?? ""),
  ]);

  const metricsByCampaign = new Map<string, { totalSpend: number; totalImpressions: number; totalLeads: number }>(
    (metrics ?? []).map((m: Record<string, unknown>) => [
      m.campaign_id as string,
      {
        totalSpend: Number(m.total_spend ?? 0),
        totalImpressions: Number(m.total_impressions ?? 0),
        totalLeads: Number(m.total_leads ?? 0),
      },
    ])
  );

  const rollups = rollupByProperty(
    (campaigns ?? []).map((c) => ({ id: c.id, propertyId: c.property_id })),
    metricsByCampaign
  );
  const rollupByPropertyId = new Map(rollups.filter((r) => r.propertyId).map((r) => [r.propertyId!, r]));

  // Campaign count per property, independent of the selected date range —
  // this is what gates whether Delete is safe to offer (PRD RBAC doesn't
  // grant broad delete rights, and silently cascading a delete into
  // untagging campaigns would be a surprising, hard-to-notice data loss).
  const campaignCountByProperty = new Map<string, number>();
  for (const c of campaigns ?? []) {
    if (!c.property_id) continue;
    campaignCountByProperty.set(c.property_id, (campaignCountByProperty.get(c.property_id) ?? 0) + 1);
  }

  // Every property shows up here now, even ones with zero campaigns tagged
  // yet — previously this page only rendered rows the campaign rollup
  // produced, so a freshly created property was invisible until something
  // was tagged to it.
  const leaderboard = (properties ?? [])
    .map((prop) => {
      const r = rollupByPropertyId.get(prop.id);
      const spend = r?.spend ?? 0;
      const leads = r?.leads ?? 0;
      const cpl = r?.cpl ?? null;
      const estRevenue = computeEstimatedRevenue(leads, prop.assumed_conversion_rate, prop.assumed_avg_deal_value);
      const estRoiPct = computeEstimatedRoiPct(spend, estRevenue);
      return {
        propertyId: prop.id,
        name: prop.name,
        city: prop.city,
        assumedConversionRate: prop.assumed_conversion_rate,
        assumedAvgDealValue: prop.assumed_avg_deal_value,
        spend,
        leads,
        cpl,
        estRevenue,
        estRoiPct,
        campaignCount: campaignCountByProperty.get(prop.id) ?? 0,
      };
    })
    .sort((a, b) => b.spend - a.spend);

  const untaggedRollup = rollups.find((r) => !r.propertyId);

  const compareIds = (params.compare ?? "").split(",").filter(Boolean);
  const compareRows = leaderboard.filter((r) => compareIds.includes(r.propertyId)).slice(0, 5);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Properties</h1>
        <div className="flex items-center gap-2 text-sm">
          <ExportCsvButton rows={leaderboard} columns={PROPERTY_EXPORT_COLUMNS} filename="properties.csv" />
          {RANGE_OPTIONS.map((r) => (
            <Link
              key={r.key}
              href={`/dashboard/properties?range=${r.key}`}
              className={`rounded-full border px-3 py-1 ${
                (params.range ?? "last30") === r.key
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted"
              }`}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      {compareRows.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-2 text-lg font-bold">Comparison</h2>
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${compareRows.length}, minmax(0, 1fr))` }}>
            {compareRows.map((r) => (
              <div key={r.propertyId} className="rounded-lg border border-border bg-surface p-3 text-sm">
                <p className="font-medium">{r.name}</p>
                <p className="text-xs text-muted">{r.city ?? "—"}</p>
                <dl className="mt-2 space-y-1">
                  <div className="flex justify-between"><dt className="text-muted">Spend</dt><dd className="tabular-nums">{r.spend.toFixed(0)}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted">Leads</dt><dd className="tabular-nums">{r.leads}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted">CPL</dt><dd className="tabular-nums">{r.cpl?.toFixed(0) ?? "—"}</dd></div>
                  <div className="flex justify-between">
                    <dt className="text-muted">Est. ROI</dt>
                    <dd>
                      <EstimatedValue
                        value={r.estRoiPct}
                        formatter={(v) => `${v.toFixed(0)}%`}
                        assumedConversionRatePct={r.assumedConversionRate}
                        assumedAvgDealValue={r.assumedAvgDealValue}
                      />
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </div>
      )}

      <TableScroller>
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="text-[10px] uppercase tracking-wide text-faint">
            <tr>
              <th className="px-3 py-2">Compare</th>
              <th className="px-3 py-2">Property</th>
              <th className="px-3 py-2 text-right">Campaigns</th>
              <th className="px-3 py-2 text-right">Spend</th>
              <th className="px-3 py-2 text-right">Leads</th>
              <th className="px-3 py-2 text-right">CPL</th>
              <th className="px-3 py-2 text-right">Est. Revenue</th>
              <th className="px-3 py-2 text-right">Est. ROI</th>
              <th className="px-3 py-2">Assumptions</th>
              <th className="px-3 py-2">Delete</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((r) => (
              <tr key={r.propertyId} className="border-t border-border">
                <td className="px-3 py-2">
                  <Link
                    href={`/dashboard/properties?range=${params.range ?? "last30"}&compare=${[...compareIds, r.propertyId].join(",")}`}
                    className="text-xs text-accent hover:underline"
                  >
                    Add
                  </Link>
                </td>
                <td className="px-3 py-2 font-medium">
                  {r.name} {r.city && <span className="text-xs text-muted">({r.city})</span>}
                </td>
                <td className="tabular-nums px-3 py-2 text-right">{r.campaignCount}</td>
                <td className="tabular-nums px-3 py-2 text-right">{r.spend.toFixed(0)}</td>
                <td className="tabular-nums px-3 py-2 text-right">{r.leads}</td>
                <td className="tabular-nums px-3 py-2 text-right">{r.cpl?.toFixed(0) ?? "—"}</td>
                <td className="tabular-nums px-3 py-2 text-right">
                  <EstimatedValue
                    value={r.estRevenue}
                    formatter={(v) => v.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    assumedConversionRatePct={r.assumedConversionRate}
                    assumedAvgDealValue={r.assumedAvgDealValue}
                  />
                </td>
                <td className="tabular-nums px-3 py-2 text-right">
                  <EstimatedValue
                    value={r.estRoiPct}
                    formatter={(v) => `${v.toFixed(0)}%`}
                    assumedConversionRatePct={r.assumedConversionRate}
                    assumedAvgDealValue={r.assumedAvgDealValue}
                  />
                </td>
                <td className="px-3 py-2">
                  <form action={updatePropertyAssumptions} className="flex items-center gap-1">
                    <input type="hidden" name="property_id" value={r.propertyId} />
                    <input
                      name="assumed_conversion_rate"
                      type="number"
                      step="0.1"
                      defaultValue={r.assumedConversionRate ?? ""}
                      placeholder="Conv %"
                      className="w-16 rounded-md border border-border bg-background px-1 py-0.5 text-xs text-foreground"
                    />
                    <input
                      name="assumed_avg_deal_value"
                      type="number"
                      defaultValue={r.assumedAvgDealValue ?? ""}
                      placeholder="Deal ₹"
                      className="w-24 rounded-md border border-border bg-background px-1 py-0.5 text-xs text-foreground"
                    />
                    <button type="submit" className="rounded-md border border-border px-2 py-0.5 text-xs">
                      Save
                    </button>
                  </form>
                </td>
                <td className="px-3 py-2">
                  {r.campaignCount === 0 ? (
                    <form action={deleteProperty}>
                      <input type="hidden" name="property_id" value={r.propertyId} />
                      <button type="submit" className="rounded-md border border-bad px-2 py-0.5 text-xs text-bad">
                        Delete
                      </button>
                    </form>
                  ) : (
                    <span className="text-xs text-faint" title="Untag its campaigns first (Campaigns page)">
                      in use
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {leaderboard.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-4 text-center text-muted">
                  No properties yet — add one from the Campaigns page.
                </td>
              </tr>
            )}
            {untaggedRollup && (
              <tr className="border-t border-border bg-surface-raised">
                <td className="px-3 py-2" />
                <td className="px-3 py-2 font-medium text-muted">Untagged campaigns</td>
                <td className="px-3 py-2 text-right text-muted">—</td>
                <td className="tabular-nums px-3 py-2 text-right">{untaggedRollup.spend.toFixed(0)}</td>
                <td className="tabular-nums px-3 py-2 text-right">{untaggedRollup.leads}</td>
                <td className="tabular-nums px-3 py-2 text-right">{untaggedRollup.cpl?.toFixed(0) ?? "—"}</td>
                <td className="px-3 py-2 text-right text-faint">n/a</td>
                <td className="px-3 py-2 text-right text-faint">n/a</td>
                <td className="px-3 py-2 text-xs text-faint">n/a</td>
                <td className="px-3 py-2 text-xs text-faint">n/a</td>
              </tr>
            )}
          </tbody>
        </table>
      </TableScroller>
    </div>
  );
}
