import { cookies } from "next/headers";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveWorkspaceId } from "@/lib/workspace";
import { loadDashboardData, sumMetrics, cityLeaderboard, campaignsNeedingAttention } from "@/lib/dashboard/data";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { LeaderboardTable } from "@/components/dashboard/LeaderboardTable";
import { AlertPanel } from "@/components/dashboard/AlertPanel";
import { AlertBanner } from "@/components/dashboard/AlertBanner";
import { WorkspaceTrendChart } from "@/components/dashboard/WorkspaceTrendChart";
import { HEALTH_DOT_CLASS, HEALTH_LABEL } from "@/lib/campaigns/health";
import { resolveDateRange, RANGE_OPTIONS } from "@/lib/campaigns/dateRange";

// One dashboard for every workspace member — the old per-persona variants
// (CEO/Director/Manager/Analyst dashboards) existed for the 5-role model
// this app used before the roles were reduced to just Administrator/User
// (see docs/DEVELOPMENT_PLAN.md's Deviation Log). Admin-only actions
// (thresholds, settings, audit log) are still gated on their own pages,
// not by which dashboard renders here.
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const cookieStore = await cookies();
  const workspaceId = await resolveActiveWorkspaceId(supabase, cookieStore.get("active_workspace_id")?.value);
  if (!workspaceId || !user) return null;

  const range = resolveDateRange(params.range ?? "last30");
  const activeRange = params.range ?? "last30";

  const data = await loadDashboardData(supabase, workspaceId, range);

  const allCampaignIds = data.campaigns.map((c) => c.id);
  const todayTotals = sumMetrics(allCampaignIds, data.metricsToday);
  const yesterdayTotals = sumMetrics(allCampaignIds, data.metricsYesterday);
  const cpl = todayTotals.leads > 0 ? todayTotals.spend / todayTotals.leads : null;

  const cities = cityLeaderboard(data);
  const attention = campaignsNeedingAttention(data);

  return (
    <div className="max-w-5xl">
      <h1 className="mb-4 text-2xl font-bold">Dashboard</h1>
      <RangePicker activeRange={activeRange} />
      <AlertBanner alerts={data.alerts} />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <KpiCard icon="₹" tone={1} label="Spend Today" value={todayTotals.spend} previousValue={yesterdayTotals.spend} formatter={(v) => v.toFixed(0)} />
        <KpiCard icon="◎" tone={2} label="Leads Today" value={todayTotals.leads} previousValue={yesterdayTotals.leads} />
        <KpiCard icon="⌀" tone={3} label="CPL Today" value={cpl ?? 0} formatter={(v) => (cpl != null ? v.toFixed(0) : "—")} />
        <KpiCard icon="▤" tone={4} label="Active Campaigns" value={data.campaigns.filter((c) => c.status === "ACTIVE").length} />
        <KpiCard icon="▲" tone="status" label="Open Alerts" value={data.alerts.length} />
      </div>

      <div className="mb-6">
        <WorkspaceTrendChart data={data.trend} />
      </div>

      <div className="mb-6 rounded-lg border border-border bg-surface p-4">
        <p className="mb-2 text-sm font-bold">Campaigns Needing Attention</p>
        {attention.length === 0 ? (
          <p className="text-sm text-muted">Nothing flagged right now.</p>
        ) : (
          <ul className="space-y-1">
            {attention.slice(0, 8).map((c) => (
              <li key={c.id} className="flex items-center gap-2 text-sm">
                <span className={`inline-block h-2 w-2 rounded-full ${HEALTH_DOT_CLASS[c.health]}`} title={HEALTH_LABEL[c.health]} />
                <Link href={`/dashboard/campaigns/${c.id}`} className="truncate hover:underline">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <LeaderboardTable title={`City Leaderboard (${data.rangeLabel})`} rows={cities} limit={8} />
        <AlertPanel alerts={data.alerts} limit={8} />
      </div>
    </div>
  );
}

/** Section 14 date-range filter, same picker pattern as Campaigns/Leads —
 * drives everything on the dashboard except the "Today"/"Yesterday" KPI
 * row, which is intentionally always-on regardless of this picker. */
function RangePicker({ activeRange }: { activeRange: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
      {RANGE_OPTIONS.map((r) => (
        <Link
          key={r.key}
          href={`/dashboard?range=${r.key}`}
          className={`rounded-full border px-3 py-1 ${
            activeRange === r.key ? "border-foreground bg-foreground text-background" : "border-border text-muted"
          }`}
        >
          {r.label}
        </Link>
      ))}
    </div>
  );
}
