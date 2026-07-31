import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAdSetsForCampaign, fetchAdsForCampaign, MetaApiError } from "@/lib/meta/client";
import { CampaignTrendChart, type TrendPoint } from "@/components/CampaignTrendChart";
import { DeltaToggle, type DeltaSet } from "@/components/DeltaToggle";
import {
  computeLifetimeBudgetUtilizationPct,
  computeDailyBudgetUtilizationPct,
  computeDaysUntilExhaustion,
  computePacingStatus,
} from "@/lib/campaigns/budgetPacing";

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function sum(rows: { spend: number; leads: number }[]): { spend: number; leads: number } {
  return rows.reduce((acc, r) => ({ spend: acc.spend + r.spend, leads: acc.leads + r.leads }), { spend: 0, leads: 0 });
}

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: campaign } = await supabase
    .from("campaign")
    .select(
      "id, name, status, objective, meta_campaign_id, ad_account_id, daily_budget, lifetime_budget, budget_remaining, ad_account(name, meta_ad_account_id, business_manager_id), property(name), sales_team_employee!campaign_manager_id_fkey(name)"
    )
    .eq("id", id)
    .single();

  if (!campaign) notFound();

  const adAccount = Array.isArray(campaign.ad_account) ? campaign.ad_account[0] : campaign.ad_account;
  const property = Array.isArray(campaign.property) ? campaign.property[0] : campaign.property;
  const manager = Array.isArray(campaign.sales_team_employee) ? campaign.sales_team_employee[0] : campaign.sales_team_employee;

  const since = isoDaysAgo(29);
  const { data: metricsRows } = await supabase
    .from("daily_metrics")
    .select("date, spend, impressions, leads, ctr, cpl")
    .eq("campaign_id", id)
    .gte("date", since)
    .order("date");

  const byDate = new Map((metricsRows ?? []).map((r) => [r.date, r]));
  const chartData: TrendPoint[] = (metricsRows ?? []).map((r) => ({
    date: r.date.slice(5), // MM-DD
    spend: Number(r.spend),
    ctr: r.ctr != null ? Number(r.ctr) : null,
    cpl: r.cpl != null ? Number(r.cpl) : null,
  }));

  const today = isoDaysAgo(0);
  const yesterday = isoDaysAgo(1);
  const todayRow = byDate.get(today);
  const yesterdayRow = byDate.get(yesterday);
  const dod: DeltaSet = {
    label: "Day over Day",
    spend: { current: Number(todayRow?.spend ?? 0), previous: Number(yesterdayRow?.spend ?? 0) },
    leads: { current: Number(todayRow?.leads ?? 0), previous: Number(yesterdayRow?.leads ?? 0) },
  };

  const last7 = (metricsRows ?? []).filter((r) => r.date >= isoDaysAgo(6));
  const prev7 = (metricsRows ?? []).filter((r) => r.date >= isoDaysAgo(13) && r.date < isoDaysAgo(6));
  const last7Sum = sum(last7.map((r) => ({ spend: Number(r.spend), leads: Number(r.leads) })));
  const prev7Sum = sum(prev7.map((r) => ({ spend: Number(r.spend), leads: Number(r.leads) })));
  const wow: DeltaSet = { label: "Week over Week", spend: { current: last7Sum.spend, previous: prev7Sum.spend }, leads: { current: last7Sum.leads, previous: prev7Sum.leads } };

  // Budget pacing (Section 9.8): recent (last 3d) vs prior (3d before that)
  // spend velocity for the pacing badge, last-7d average for the linear
  // exhaustion forecast.
  const last3 = (metricsRows ?? []).filter((r) => r.date >= isoDaysAgo(2));
  const prior3 = (metricsRows ?? []).filter((r) => r.date >= isoDaysAgo(5) && r.date < isoDaysAgo(2));
  const last3AvgSpend = last3.length > 0 ? sum(last3.map((r) => ({ spend: Number(r.spend), leads: 0 }))).spend / last3.length : 0;
  const prior3AvgSpend = prior3.length > 0 ? sum(prior3.map((r) => ({ spend: Number(r.spend), leads: 0 }))).spend / prior3.length : 0;
  const avgDailySpend7d = last7.length > 0 ? last7Sum.spend / last7.length : 0;

  const dailyBudget = campaign.daily_budget != null ? Number(campaign.daily_budget) : null;
  const lifetimeBudget = campaign.lifetime_budget != null ? Number(campaign.lifetime_budget) : null;
  const budgetRemaining = campaign.budget_remaining != null ? Number(campaign.budget_remaining) : null;

  const utilizationPct = lifetimeBudget != null
    ? computeLifetimeBudgetUtilizationPct(lifetimeBudget, budgetRemaining)
    : computeDailyBudgetUtilizationPct(dailyBudget, Number(todayRow?.spend ?? 0));
  const daysUntilExhaustion = lifetimeBudget != null ? computeDaysUntilExhaustion(budgetRemaining, avgDailySpend7d) : null;
  const pacingStatus = computePacingStatus(last3AvgSpend, prior3AvgSpend);
  const hasBudgetData = dailyBudget != null || lifetimeBudget != null;

  const PACING_LABEL: Record<string, string> = { ahead: "Ahead of pace", on_track: "On track", behind: "Behind pace" };
  const PACING_CLASS: Record<string, string> = {
    ahead: "text-amber-600",
    on_track: "text-emerald-600",
    behind: "text-amber-600",
  };

  // Live ad set / ad / creative drill-down — fetched fresh on each view, not
  // stored, since it's structural detail for one campaign rather than a
  // daily-sync-scale rollup (docs/DEVELOPMENT_PLAN.md Sprint 3 notes).
  let adSets: { id: string; name: string; status?: string }[] = [];
  let ads: { id: string; name: string; status?: string; adset_id?: string; creative?: { thumbnail_url?: string; title?: string } }[] = [];
  let liveDataError: string | null = null;

  try {
    const admin = createAdminClient();
    const { data: bm } = await admin
      .from("business_manager")
      .select("system_user_token_secret_ref")
      .eq("id", (adAccount as { business_manager_id?: string } | null)?.business_manager_id ?? "")
      .single();

    if (bm?.system_user_token_secret_ref) {
      const { data: token } = await admin.rpc("get_meta_token", { secret_id: bm.system_user_token_secret_ref });
      if (token) {
        [adSets, ads] = await Promise.all([
          fetchAdSetsForCampaign(campaign.meta_campaign_id, token),
          fetchAdsForCampaign(campaign.meta_campaign_id, token),
        ]);
      }
    }
  } catch (e) {
    liveDataError = e instanceof MetaApiError ? e.message : "Could not load ad set/ad breakdown from Meta right now.";
  }

  return (
    <div className="max-w-4xl">
      <Link href="/dashboard/campaigns" className="text-sm text-zinc-500 underline">
        ← Campaigns
      </Link>
      <h1 className="mb-1 mt-2 text-2xl font-semibold text-black dark:text-zinc-50">{campaign.name}</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        {(adAccount as { name?: string } | null)?.name ?? "—"} · {campaign.status ?? "—"} · {campaign.objective ?? "—"} ·
        Property: {(property as { name?: string } | null)?.name ?? "unset"} · Manager:{" "}
        {(manager as { name?: string } | null)?.name ?? "unset"}
      </p>

      <h2 className="mb-2 text-lg font-semibold text-black dark:text-zinc-50">Trend (last 30 days)</h2>
      <div className="mb-8">
        <CampaignTrendChart data={chartData} />
      </div>

      <h2 className="mb-2 text-lg font-semibold text-black dark:text-zinc-50">Comparison</h2>
      <div className="mb-8">
        <DeltaToggle dod={dod} wow={wow} />
      </div>

      <h2 className="mb-2 text-lg font-semibold text-black dark:text-zinc-50">Budget & Pacing</h2>
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {!hasBudgetData && (
          <p className="col-span-full text-sm text-zinc-500">No budget set on this campaign in Meta.</p>
        )}
        {lifetimeBudget != null && (
          <div className="rounded border border-zinc-200 p-3 dark:border-zinc-800">
            <p className="text-xs uppercase text-zinc-500">Lifetime Budget</p>
            <p className="text-lg font-semibold">{lifetimeBudget.toFixed(0)}</p>
          </div>
        )}
        {dailyBudget != null && (
          <div className="rounded border border-zinc-200 p-3 dark:border-zinc-800">
            <p className="text-xs uppercase text-zinc-500">Daily Budget</p>
            <p className="text-lg font-semibold">{dailyBudget.toFixed(0)}</p>
          </div>
        )}
        {utilizationPct != null && (
          <div className="rounded border border-zinc-200 p-3 dark:border-zinc-800">
            <p className="text-xs uppercase text-zinc-500">Utilization</p>
            <p className="text-lg font-semibold">{utilizationPct.toFixed(0)}%</p>
          </div>
        )}
        {daysUntilExhaustion != null && (
          <div className="rounded border border-zinc-200 p-3 dark:border-zinc-800">
            <p className="text-xs uppercase text-zinc-500">Days to Exhaustion</p>
            <p className="text-lg font-semibold">{daysUntilExhaustion.toFixed(0)}</p>
          </div>
        )}
        {hasBudgetData && (
          <div className="rounded border border-zinc-200 p-3 dark:border-zinc-800">
            <p className="text-xs uppercase text-zinc-500">Pacing</p>
            <p className={`text-lg font-semibold ${PACING_CLASS[pacingStatus]}`}>{PACING_LABEL[pacingStatus]}</p>
          </div>
        )}
      </div>

      <h2 className="mb-2 text-lg font-semibold text-black dark:text-zinc-50">Ad Sets & Ads</h2>
      {liveDataError && <p className="mb-4 text-sm text-amber-600">{liveDataError}</p>}
      {!liveDataError && adSets.length === 0 && ads.length === 0 && (
        <p className="mb-8 text-sm text-zinc-500">No ad sets found for this campaign.</p>
      )}
      {ads.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {ads.map((ad) => (
            <div key={ad.id} className="rounded border border-zinc-200 p-3 text-sm dark:border-zinc-800">
              {ad.creative?.thumbnail_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ad.creative.thumbnail_url} alt={ad.creative.title ?? ad.name} className="mb-2 w-full rounded" />
              )}
              <p className="truncate font-medium">{ad.name}</p>
              <p className="text-xs text-zinc-500">{ad.status}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
