import { cookies } from "next/headers";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveWorkspaceId } from "@/lib/workspace";
import { getDashboardContext } from "@/lib/dashboard/context";
import {
  loadDashboardData,
  sumMetrics,
  propertyLeaderboard,
  cityLeaderboard,
  totalEstimatedRevenue,
  campaignsNeedingAttention,
  type DashboardData,
} from "@/lib/dashboard/data";
import { getLatestProfitabilitySnapshots, type LatestProfitabilitySnapshot } from "@/lib/profitability/query";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { LeaderboardTable } from "@/components/dashboard/LeaderboardTable";
import { AlertPanel } from "@/components/dashboard/AlertPanel";
import { WorkspaceTrendChart } from "@/components/dashboard/WorkspaceTrendChart";
import { ProfitabilitySnapshotWidget } from "@/components/dashboard/ProfitabilitySnapshotWidget";
import { ProfitabilityPanel } from "@/components/dashboard/ProfitabilityPanel";
import { HEALTH_DOT_CLASS, HEALTH_LABEL } from "@/lib/campaigns/health";
import { computeEstimatedRoiPct } from "@/lib/analytics/estimatedRoi";
import { EstimatedValue } from "@/components/EstimatedValue";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const cookieStore = await cookies();
  const workspaceId = await resolveActiveWorkspaceId(supabase, cookieStore.get("active_workspace_id")?.value);
  if (!workspaceId || !user) return null;

  const [context, data, profitabilitySnapshots] = await Promise.all([
    getDashboardContext(supabase, workspaceId, user.id),
    loadDashboardData(supabase, workspaceId),
    getLatestProfitabilitySnapshots(supabase, workspaceId),
  ]);

  const allCampaignIds = data.campaigns.map((c) => c.id);
  const todayTotals = sumMetrics(allCampaignIds, data.metricsToday);
  const yesterdayTotals = sumMetrics(allCampaignIds, data.metricsYesterday);

  switch (context.roleName) {
    case "CEO":
      return (
        <CeoDashboard data={data} todayTotals={todayTotals} yesterdayTotals={yesterdayTotals} profitability={profitabilitySnapshots} />
      );
    case "Marketing Manager":
      return <ManagerDashboard data={data} todayTotals={todayTotals} yesterdayTotals={yesterdayTotals} profitability={profitabilitySnapshots} />;
    case "Data Analyst":
      return <AnalystDashboard data={data} />;
    case "Marketing Director":
    case "Administrator":
    default:
      // Administrator falls back to the full Director/Management view —
      // reasonable for small teams where one person holds both roles
      // (PRD Section 5.1), and there's no dedicated Admin data-dashboard
      // spec in Section 11 (Section 7.5 points Admins at the Admin Panel
      // instead, which is Sprint 9 scope).
      return (
        <DirectorDashboard data={data} todayTotals={todayTotals} yesterdayTotals={yesterdayTotals} profitability={profitabilitySnapshots} />
      );
  }
}

function CeoDashboard({
  data,
  todayTotals,
  yesterdayTotals,
  profitability,
}: {
  data: DashboardData;
  todayTotals: { spend: number; leads: number };
  yesterdayTotals: { spend: number; leads: number };
  profitability: LatestProfitabilitySnapshot[];
}) {
  const properties = propertyLeaderboard(data).sort((a, b) => b.spend - a.spend);
  const top3 = properties.slice(0, 3);
  const bottom3 = properties.slice(-3).reverse();
  const estRevenue = totalEstimatedRevenue(data);
  const estRoiPct = computeEstimatedRoiPct(todayTotals.spend || 1, estRevenue);

  return (
    <div className="max-w-5xl">
      <h1 className="mb-4 text-2xl font-semibold text-black dark:text-zinc-50">CEO Dashboard</h1>
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Spend Today" value={todayTotals.spend} previousValue={yesterdayTotals.spend} formatter={(v) => v.toFixed(0)} />
        <KpiCard label="Leads Today" value={todayTotals.leads} previousValue={yesterdayTotals.leads} />
        <div className="rounded border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Est. Revenue (30d)</p>
          <p className="text-2xl font-semibold">
            <EstimatedValue value={estRevenue} formatter={(v) => v.toLocaleString(undefined, { maximumFractionDigits: 0 })} assumedConversionRatePct={null} assumedAvgDealValue={null} />
          </p>
        </div>
        <div className="rounded border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Est. ROI</p>
          <p className="text-2xl font-semibold">
            <EstimatedValue value={estRoiPct} formatter={(v) => `${v.toFixed(0)}%`} assumedConversionRatePct={null} assumedAvgDealValue={null} />
          </p>
        </div>
      </div>

      <div className="mb-6">
        <WorkspaceTrendChart data={data.trend} />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <LeaderboardTable title="Top 3 Properties" rows={top3} limit={3} />
        <LeaderboardTable title="Bottom 3 Properties" rows={bottom3} limit={3} />
        <AlertPanel alerts={data.alerts} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ProfitabilitySnapshotWidget snapshots={profitability} />
      </div>
    </div>
  );
}

function DirectorDashboard({
  data,
  todayTotals,
  yesterdayTotals,
  profitability,
}: {
  data: DashboardData;
  todayTotals: { spend: number; leads: number };
  yesterdayTotals: { spend: number; leads: number };
  profitability: LatestProfitabilitySnapshot[];
}) {
  const properties = propertyLeaderboard(data);
  const cities = cityLeaderboard(data);

  return (
    <div className="max-w-5xl">
      <h1 className="mb-4 text-2xl font-semibold text-black dark:text-zinc-50">Management Dashboard</h1>
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Spend Today" value={todayTotals.spend} previousValue={yesterdayTotals.spend} formatter={(v) => v.toFixed(0)} />
        <KpiCard label="Leads Today" value={todayTotals.leads} previousValue={yesterdayTotals.leads} />
        <KpiCard label="Active Campaigns" value={data.campaigns.filter((c) => c.status === "ACTIVE").length} />
        <KpiCard label="Open Alerts" value={data.alerts.length} />
      </div>

      <div className="mb-6">
        <WorkspaceTrendChart data={data.trend} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <LeaderboardTable title="Property Leaderboard" rows={properties} limit={8} />
        <LeaderboardTable title="City Leaderboard" rows={cities} limit={8} />
        <ProfitabilityPanel snapshots={profitability} limit={8} />
        <AlertPanel alerts={data.alerts} limit={8} />
      </div>
    </div>
  );
}

function ManagerDashboard({
  data,
  todayTotals,
  yesterdayTotals,
  profitability,
}: {
  data: DashboardData;
  todayTotals: { spend: number; leads: number };
  yesterdayTotals: { spend: number; leads: number };
  profitability: LatestProfitabilitySnapshot[];
}) {
  const cpl = todayTotals.leads > 0 ? todayTotals.spend / todayTotals.leads : null;
  const attention = campaignsNeedingAttention(data);

  return (
    <div className="max-w-5xl">
      <h1 className="mb-4 text-2xl font-semibold text-black dark:text-zinc-50">Manager Dashboard</h1>
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Spend Today" value={todayTotals.spend} previousValue={yesterdayTotals.spend} formatter={(v) => v.toFixed(0)} />
        <KpiCard label="Leads Today" value={todayTotals.leads} previousValue={yesterdayTotals.leads} />
        <KpiCard label="CPL Today" value={cpl ?? 0} formatter={(v) => (cpl != null ? v.toFixed(0) : "—")} />
        <KpiCard label="Open Alerts" value={data.alerts.length} />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="mb-2 text-sm font-semibold text-black dark:text-zinc-50">Campaigns Needing Attention</p>
          {attention.length === 0 ? (
            <p className="text-sm text-zinc-500">Nothing flagged right now.</p>
          ) : (
            <ul className="space-y-1">
              {attention.slice(0, 8).map((c) => (
                <li key={c.id} className="flex items-center gap-2 text-sm">
                  <span className={`inline-block h-2 w-2 rounded-full ${HEALTH_DOT_CLASS[c.health]}`} title={HEALTH_LABEL[c.health]} />
                  <Link href={`/dashboard/campaigns/${c.id}`} className="truncate hover:underline">
                    {c.name}
                  </Link>
                  <span className="text-xs text-zinc-500">({c.adAccountName})</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <ProfitabilityPanel snapshots={profitability} limit={8} />
      </div>

      <AlertPanel alerts={data.alerts} limit={8} />
    </div>
  );
}

function AnalystDashboard({ data }: { data: DashboardData }) {
  // Section 11.4 asks for a pivot-table builder — deliberately scoped down
  // to a full sortable KPI table for MVP; see docs/DEVELOPMENT_PLAN.md.
  const rows = data.campaigns
    .map((c) => {
      const m = data.metricsLast30.get(c.id);
      return {
        id: c.id,
        name: c.propertyName ?? "Untagged",
        account: c.adAccountName,
        spend: m?.totalSpend ?? 0,
        leads: m?.totalLeads ?? 0,
      };
    })
    .filter((r) => r.spend > 0)
    .sort((a, b) => b.spend - a.spend);

  return (
    <div className="max-w-5xl">
      <h1 className="mb-4 text-2xl font-semibold text-black dark:text-zinc-50">Analyst View</h1>
      <p className="mb-4 text-sm text-zinc-500">
        Full KPI table across every campaign with data in the last 30 days — a drag-drop pivot builder is Phase 2
        scope (Section 24); export via Campaigns/Properties pages in the meantime.
      </p>
      <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[500px] text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2">Property</th>
              <th className="px-3 py-2">Account</th>
              <th className="px-3 py-2 text-right">Spend</th>
              <th className="px-3 py-2 text-right">Leads</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="px-3 py-2">{r.name}</td>
                <td className="px-3 py-2">{r.account}</td>
                <td className="px-3 py-2 text-right">{r.spend.toFixed(0)}</td>
                <td className="px-3 py-2 text-right">{r.leads}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
