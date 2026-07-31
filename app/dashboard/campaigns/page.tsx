import { cookies } from "next/headers";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveWorkspaceId } from "@/lib/workspace";
import { computeHealthStatus } from "@/lib/campaigns/health";
import { resolveDateRange, RANGE_OPTIONS } from "@/lib/campaigns/dateRange";
import { CampaignTable, type CampaignRow } from "@/components/CampaignTable";
import { createProperty, createSalesTeamEmployee, autoTagFromNaming } from "./actions";

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
    .select("id, name, status, objective, ad_account(name), property(name), sales_team_employee!campaign_manager_id_fkey(name)")
    .eq("workspace_id", workspaceId ?? "");

  if (params.q) query = query.ilike("name", `%${params.q}%`);
  if (params.status) query = query.eq("status", params.status);

  const [{ data: campaigns }, { data: metrics }, { data: properties }, { data: employees }, { count: taggedCount }] =
    await Promise.all([
      query,
      supabase.rpc("campaign_metrics_summary", { p_workspace_id: workspaceId, p_since: since, p_until: until }),
      supabase.from("property").select("id, name").eq("workspace_id", workspaceId ?? ""),
      supabase.from("sales_team_employee").select("id, name").eq("workspace_id", workspaceId ?? ""),
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
    const ctr = m?.latest_ctr != null ? Number(m.latest_ctr) : null;
    const frequency = m?.latest_frequency != null ? Number(m.latest_frequency) : null;

    const adAccount = Array.isArray(c.ad_account) ? c.ad_account[0] : c.ad_account;
    const property = Array.isArray(c.property) ? c.property[0] : c.property;
    const manager = Array.isArray(c.sales_team_employee) ? c.sales_team_employee[0] : c.sales_team_employee;

    return {
      id: c.id as string,
      name: c.name as string,
      status: c.status as string | null,
      objective: c.objective as string | null,
      adAccountName: (adAccount as { name?: string } | null)?.name ?? "—",
      propertyName: (property as { name?: string } | null)?.name ?? null,
      managerName: (manager as { name?: string } | null)?.name ?? null,
      spend,
      impressions,
      leads,
      cpl,
      health: computeHealthStatus({ status: c.status as string | null, ctr, frequency, spend, impressions, leads }),
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

  const completenessPct = totalCampaignCount ? Math.round(((taggedCount ?? 0) / totalCampaignCount) * 100) : 0;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Campaigns</h1>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          Tagging completeness: <strong>{completenessPct}%</strong> ({taggedCount ?? 0}/{totalCampaignCount ?? 0})
        </span>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        {RANGE_OPTIONS.map((r) => (
          <Link
            key={r.key}
            href={`/dashboard/campaigns?range=${r.key}`}
            className={`rounded border px-3 py-1 ${
              (params.range ?? "last7") === r.key
                ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                : "border-zinc-300 dark:border-zinc-700"
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
            className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button type="submit" className="rounded border border-zinc-300 px-3 py-1 dark:border-zinc-700">
            Search
          </button>
        </form>

        <form action={autoTagFromNaming}>
          <button type="submit" className="rounded border border-zinc-300 px-3 py-1 dark:border-zinc-700">
            Auto-tag from naming
          </button>
        </form>
      </div>

      {totalCount === 0 && (params.q || params.status) && (
        <p className="mb-4 text-sm text-zinc-500">No campaigns match this search/filter.</p>
      )}

      <CampaignTable rows={rows} properties={properties ?? []} managers={employees ?? []} />

      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-zinc-600 dark:text-zinc-400">
          Page {page} of {totalPages} ({totalCount} campaigns)
        </span>
        <div className="flex gap-2">
          {page > 1 && (
            <Link
              href={`/dashboard/campaigns?range=${params.range ?? "last7"}&page=${page - 1}`}
              className="rounded border border-zinc-300 px-3 py-1 dark:border-zinc-700"
            >
              Previous
            </Link>
          )}
          {page < totalPages && (
            <Link
              href={`/dashboard/campaigns?range=${params.range ?? "last7"}&page=${page + 1}`}
              className="rounded border border-zinc-300 px-3 py-1 dark:border-zinc-700"
            >
              Next
            </Link>
          )}
        </div>
      </div>

      <details className="mt-8 rounded border border-zinc-200 p-4 dark:border-zinc-800">
        <summary className="cursor-pointer text-sm font-medium">Add Property / Manager manually</summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <form action={createProperty} className="space-y-2">
            <p className="text-sm font-medium">New Property</p>
            <input name="name" required placeholder="Property name" className="w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
            <input name="city" placeholder="City (optional)" className="w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
            <button type="submit" className="rounded bg-black px-3 py-1 text-sm text-white dark:bg-white dark:text-black">
              Add Property
            </button>
          </form>
          <form action={createSalesTeamEmployee} className="space-y-2">
            <p className="text-sm font-medium">New Team Member</p>
            <input name="name" required placeholder="Name" className="w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
            <select name="role" className="w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900">
              <option value="Manager">Manager</option>
              <option value="Supervisor">Supervisor</option>
              <option value="Executive">Executive</option>
            </select>
            <button type="submit" className="rounded bg-black px-3 py-1 text-sm text-white dark:bg-white dark:text-black">
              Add Team Member
            </button>
          </form>
        </div>
      </details>
    </div>
  );
}
