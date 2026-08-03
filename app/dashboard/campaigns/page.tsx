import { cookies } from "next/headers";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveWorkspaceId } from "@/lib/workspace";
import { computeHealthStatus } from "@/lib/campaigns/health";
import { resolveDateRange, RANGE_OPTIONS } from "@/lib/campaigns/dateRange";
import { CampaignTable, type CampaignRow } from "@/components/CampaignTable";
import { createProperty } from "./actions";

const PAGE_SIZE = 50;

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; q?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const cookieStore = await cookies();
  const workspaceId = await resolveActiveWorkspaceId(supabase, cookieStore.get("active_workspace_id")?.value);

  const { since, until } = resolveDateRange(params.range);
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  // Fetched unpaginated (922 campaigns is a light payload without daily_metrics
  // attached) so we can rank by the selected range's spend before paginating —
  // sorting DB-side by name and only then merging in metrics meant the same
  // zero-activity campaigns always landed on page 1 regardless of date range.
  let query = supabase
    .from("campaign")
    .select("id, name, status, objective, city, ad_account(name), property(name)")
    .eq("workspace_id", workspaceId ?? "");

  if (params.q) query = query.ilike("name", `%${params.q}%`);
  if (params.status) query = query.eq("status", params.status);

  const [{ data: campaigns }, { data: metrics }, { data: properties }, { count: taggedCount }] = await Promise.all([
    query,
    supabase.rpc("campaign_metrics_summary", { p_workspace_id: workspaceId, p_since: since, p_until: until }),
    supabase.from("property").select("id, name").eq("workspace_id", workspaceId ?? ""),
    supabase
      .from("campaign")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId ?? "")
      .not("property_id", "is", null),
  ]);

  const { count: totalCampaignCount } = await supabase
    .from("campaign")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId ?? "");

  const metricsByCampaign = new Map((metrics ?? []).map((m: Record<string, unknown>) => [m.campaign_id as string, m]));

  const allRows: CampaignRow[] = (campaigns ?? []).map((c: Record<string, unknown>) => {
    const m = metricsByCampaign.get(c.id as string) as Record<string, unknown> | undefined;
    const spend = Number(m?.total_spend ?? 0);
    const impressions = Number(m?.total_impressions ?? 0);
    const leads = Number(m?.total_leads ?? 0);
    const cpl = m?.computed_cpl != null ? Number(m.computed_cpl) : null;
    // Health heuristic still uses Meta's latest-day ctr/frequency (it's
    // asking "is this campaign healthy right now," not "over this range").
    const latestCtr = m?.latest_ctr != null ? Number(m.latest_ctr) : null;
    const latestFrequency = m?.latest_frequency != null ? Number(m.latest_frequency) : null;
    // These, in contrast, are range-correct — computed in SQL from raw
    // summable totals (campaign_metrics_summary, migration 0010), not an
    // average of Meta's daily ratios.
    const ctr = m?.computed_ctr != null ? Number(m.computed_ctr) : null;
    const cpc = m?.computed_cpc != null ? Number(m.computed_cpc) : null;
    const cpm = m?.computed_cpm != null ? Number(m.computed_cpm) : null;

    const adAccount = Array.isArray(c.ad_account) ? c.ad_account[0] : c.ad_account;
    const property = Array.isArray(c.property) ? c.property[0] : c.property;

    return {
      id: c.id as string,
      name: c.name as string,
      status: c.status as string | null,
      objective: c.objective as string | null,
      adAccountName: (adAccount as { name?: string } | null)?.name ?? "—",
      propertyName: (property as { name?: string } | null)?.name ?? null,
      city: (c.city as string | null) ?? null,
      spend,
      impressions,
      leads,
      cpl,
      ctr,
      cpc,
      cpm,
      latestFrequency,
      health: computeHealthStatus({ status: c.status as string | null, ctr: latestCtr, frequency: latestFrequency, spend, impressions, leads }),
      recommendation: null,
    };
  });

  // Default sort: highest spend in the selected range first — this is what
  // makes "which campaign needs attention" (PRD Objective, Section 3)
  // answerable at a glance, rather than an alphabetical accident.
  allRows.sort((a, b) => b.spend - a.spend);

  const totalCount = allRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const from = (page - 1) * PAGE_SIZE;
  const rows = allRows.slice(from, from + PAGE_SIZE);

  // Profitability Advisor (Section 9.10) verdicts — fetched only for the
  // current page's campaigns, latest snapshot per campaign.
  if (rows.length > 0) {
    const { data: snapshots } = await supabase
      .from("profitability_snapshot")
      .select("campaign_id, recommendation, evaluated_at")
      .in("campaign_id", rows.map((r) => r.id))
      .order("evaluated_at", { ascending: false });
    const latestByCampaign = new Map<string, string>();
    for (const s of snapshots ?? []) {
      if (!latestByCampaign.has(s.campaign_id)) latestByCampaign.set(s.campaign_id, s.recommendation);
    }
    for (const r of rows) {
      r.recommendation = (latestByCampaign.get(r.id) as CampaignRow["recommendation"]) ?? null;
    }
  }

  const completenessPct = totalCampaignCount ? Math.round(((taggedCount ?? 0) / totalCampaignCount) * 100) : 0;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Campaigns</h1>
        <span className="text-sm text-muted">
          Tagging completeness: <strong className="text-foreground">{completenessPct}%</strong> ({taggedCount ?? 0}/{totalCampaignCount ?? 0})
        </span>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        {RANGE_OPTIONS.map((r) => (
          <Link
            key={r.key}
            href={`/dashboard/campaigns?range=${r.key}`}
            className={`rounded-full border px-3 py-1 ${
              (params.range ?? "last7") === r.key
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted"
            }`}
          >
            {r.label}
          </Link>
        ))}

        <form className="ml-auto flex items-center gap-2" action="/dashboard/campaigns">
          <input type="hidden" name="range" value={params.range ?? "last7"} />
          <input
            name="q"
            defaultValue={params.q}
            placeholder="Search campaigns…"
            className="rounded-md border border-border bg-surface px-2 py-1 text-foreground"
          />
          <button type="submit" className="rounded-md border border-border px-3 py-1">
            Search
          </button>
        </form>
      </div>

      {totalCount === 0 && (params.q || params.status) && (
        <p className="mb-4 text-sm text-muted">No campaigns match this search/filter.</p>
      )}

      <CampaignTable rows={rows} properties={properties ?? []} />

      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-muted">
          Page {page} of {totalPages} ({totalCount} campaigns)
        </span>
        <div className="flex gap-2">
          {page > 1 && (
            <Link
              href={`/dashboard/campaigns?range=${params.range ?? "last7"}&page=${page - 1}`}
              className="rounded-md border border-border px-3 py-1"
            >
              Previous
            </Link>
          )}
          {page < totalPages && (
            <Link
              href={`/dashboard/campaigns?range=${params.range ?? "last7"}&page=${page + 1}`}
              className="rounded-md border border-border px-3 py-1"
            >
              Next
            </Link>
          )}
        </div>
      </div>

      <details className="mt-8 rounded-lg border border-border bg-surface p-4">
        <summary className="cursor-pointer text-sm font-medium">Add Property manually</summary>
        <form action={createProperty} className="mt-3 max-w-sm space-y-2">
          <input name="name" required placeholder="Property name" className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground" />
          <input name="city" placeholder="City (optional)" className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground" />
          <button type="submit" className="rounded-md bg-foreground px-3 py-1 text-sm text-background">
            Add Property
          </button>
        </form>
      </details>
    </div>
  );
}
