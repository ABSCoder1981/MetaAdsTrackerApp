import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveWorkspaceId } from "@/lib/workspace";
import { resolveDateRange, RANGE_OPTIONS } from "@/lib/campaigns/dateRange";
import { rollupByProperty } from "@/lib/analytics/propertyRollup";
import { computeEstimatedRevenue, computeEstimatedRoiPct } from "@/lib/analytics/estimatedRoi";
import { EstimatedValue } from "@/components/EstimatedValue";
import Link from "next/link";
import { updatePropertyAssumptions } from "./actions";

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

  const propertyById = new Map((properties ?? []).map((p) => [p.id, p]));

  const leaderboard = rollups
    .map((r) => {
      const prop = r.propertyId ? propertyById.get(r.propertyId) : null;
      const estRevenue = computeEstimatedRevenue(r.leads, prop?.assumed_conversion_rate ?? null, prop?.assumed_avg_deal_value ?? null);
      const estRoiPct = computeEstimatedRoiPct(r.spend, estRevenue);
      return {
        ...r,
        name: prop?.name ?? "Untagged",
        city: prop?.city ?? null,
        assumedConversionRate: prop?.assumed_conversion_rate ?? null,
        assumedAvgDealValue: prop?.assumed_avg_deal_value ?? null,
        estRevenue,
        estRoiPct,
      };
    })
    .sort((a, b) => b.spend - a.spend);

  const compareIds = (params.compare ?? "").split(",").filter(Boolean);
  const compareRows = leaderboard.filter((r) => r.propertyId && compareIds.includes(r.propertyId)).slice(0, 5);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Properties</h1>
        <div className="flex gap-2 text-sm">
          {RANGE_OPTIONS.map((r) => (
            <Link
              key={r.key}
              href={`/dashboard/properties?range=${r.key}`}
              className={`rounded border px-3 py-1 ${
                (params.range ?? "last30") === r.key
                  ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                  : "border-zinc-300 dark:border-zinc-700"
              }`}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      {compareRows.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-2 text-lg font-semibold text-black dark:text-zinc-50">Comparison</h2>
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${compareRows.length}, minmax(0, 1fr))` }}>
            {compareRows.map((r) => (
              <div key={r.propertyId} className="rounded border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                <p className="font-medium">{r.name}</p>
                <p className="text-xs text-zinc-500">{r.city ?? "—"}</p>
                <dl className="mt-2 space-y-1">
                  <div className="flex justify-between"><dt className="text-zinc-500">Spend</dt><dd>{r.spend.toFixed(0)}</dd></div>
                  <div className="flex justify-between"><dt className="text-zinc-500">Leads</dt><dd>{r.leads}</dd></div>
                  <div className="flex justify-between"><dt className="text-zinc-500">CPL</dt><dd>{r.cpl?.toFixed(0) ?? "—"}</dd></div>
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">Est. ROI</dt>
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

      <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2">Compare</th>
              <th className="px-3 py-2">Property</th>
              <th className="px-3 py-2 text-right">Spend</th>
              <th className="px-3 py-2 text-right">Leads</th>
              <th className="px-3 py-2 text-right">CPL</th>
              <th className="px-3 py-2 text-right">Est. Revenue</th>
              <th className="px-3 py-2 text-right">Est. ROI</th>
              <th className="px-3 py-2">Assumptions</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((r) => (
              <tr key={r.propertyId ?? "untagged"} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="px-3 py-2">
                  {r.propertyId && (
                    <Link
                      href={`/dashboard/properties?range=${params.range ?? "last30"}&compare=${[...compareIds, r.propertyId].join(",")}`}
                      className="text-xs underline"
                    >
                      Add
                    </Link>
                  )}
                </td>
                <td className="px-3 py-2 font-medium">
                  {r.name} {r.city && <span className="text-xs text-zinc-500">({r.city})</span>}
                </td>
                <td className="px-3 py-2 text-right">{r.spend.toFixed(0)}</td>
                <td className="px-3 py-2 text-right">{r.leads}</td>
                <td className="px-3 py-2 text-right">{r.cpl?.toFixed(0) ?? "—"}</td>
                <td className="px-3 py-2 text-right">
                  <EstimatedValue
                    value={r.estRevenue}
                    formatter={(v) => v.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    assumedConversionRatePct={r.assumedConversionRate}
                    assumedAvgDealValue={r.assumedAvgDealValue}
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <EstimatedValue
                    value={r.estRoiPct}
                    formatter={(v) => `${v.toFixed(0)}%`}
                    assumedConversionRatePct={r.assumedConversionRate}
                    assumedAvgDealValue={r.assumedAvgDealValue}
                  />
                </td>
                <td className="px-3 py-2">
                  {r.propertyId ? (
                    <form action={updatePropertyAssumptions} className="flex items-center gap-1">
                      <input type="hidden" name="property_id" value={r.propertyId} />
                      <input
                        name="assumed_conversion_rate"
                        type="number"
                        step="0.1"
                        defaultValue={r.assumedConversionRate ?? ""}
                        placeholder="Conv %"
                        className="w-16 rounded border border-zinc-300 px-1 py-0.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                      />
                      <input
                        name="assumed_avg_deal_value"
                        type="number"
                        defaultValue={r.assumedAvgDealValue ?? ""}
                        placeholder="Deal ₹"
                        className="w-24 rounded border border-zinc-300 px-1 py-0.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                      />
                      <button type="submit" className="rounded border border-zinc-300 px-2 py-0.5 text-xs dark:border-zinc-700">
                        Save
                      </button>
                    </form>
                  ) : (
                    <span className="text-xs text-zinc-400">n/a</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
