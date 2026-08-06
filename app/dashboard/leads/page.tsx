import { cookies, headers } from "next/headers";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveWorkspaceId } from "@/lib/workspace";
import { resolveDateRange, RANGE_OPTIONS } from "@/lib/campaigns/dateRange";
import { QualityTagSelect } from "@/components/QualityTagSelect";
import { TableScroller } from "@/components/TableScroller";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const cookieStore = await cookies();
  const workspaceId = await resolveActiveWorkspaceId(supabase, cookieStore.get("active_workspace_id")?.value);
  const { since, until } = resolveDateRange(params.range ?? "last30");

  const [{ data: campaigns }, { data: metrics }, { data: individualLeads }, { data: workspaceRow }] = await Promise.all([
    supabase
      .from("campaign")
      .select("id, name")
      .eq("workspace_id", workspaceId ?? ""),
    supabase.rpc("campaign_metrics_summary", { p_workspace_id: workspaceId, p_since: since, p_until: until }),
    supabase
      .from("lead")
      .select("id, source, quality_tag, created_at, campaign(name)")
      .eq("workspace_id", workspaceId ?? "")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("workspace").select("webhook_secret").eq("id", workspaceId ?? "").single(),
  ]);

  const host = (await headers()).get("host");
  const webhookUrl = workspaceRow?.webhook_secret
    ? `${host?.includes("localhost") ? "http" : "https"}://${host}/api/leads/webhook?token=${workspaceRow.webhook_secret}`
    : null;

  const metricsByCampaign = new Map(
    (metrics ?? []).map((m: Record<string, unknown>) => [m.campaign_id as string, m])
  );

  const byCampaign = (campaigns ?? [])
    .map((c) => {
      const m = metricsByCampaign.get(c.id) as Record<string, unknown> | undefined;
      return {
        id: c.id,
        name: c.name,
        leads: Number(m?.total_leads ?? 0),
        spend: Number(m?.total_spend ?? 0),
        cpl: m?.computed_cpl != null ? Number(m.computed_cpl) : null,
      };
    })
    .filter((c) => c.leads > 0)
    .sort((a, b) => b.leads - a.leads)
    .slice(0, 20);

  const totalLeads = byCampaign.reduce((sum, c) => sum + c.leads, 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Leads</h1>
        <div className="flex gap-2 text-sm">
          {RANGE_OPTIONS.map((r) => (
            <Link
              key={r.key}
              href={`/dashboard/leads?range=${r.key}`}
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

      <p className="mb-4 text-sm text-muted">
        <strong className="text-foreground">{totalLeads}</strong> leads attributed across the top 20 campaigns in
        this range (from Meta&rsquo;s reported conversions — see Campaign Detail for per-campaign trend).
      </p>

      <h2 className="mb-2 text-lg font-bold">Top Campaigns by Leads</h2>
      <TableScroller className="mb-8">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead className="text-[10px] uppercase tracking-wide text-faint">
            <tr>
              <th className="px-3 py-2">Campaign</th>
              <th className="px-3 py-2 text-right">Leads</th>
              <th className="px-3 py-2 text-right">Spend</th>
              <th className="px-3 py-2 text-right">CPL</th>
            </tr>
          </thead>
          <tbody>
            {byCampaign.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="max-w-[280px] truncate px-3 py-2 font-medium">
                  <Link href={`/dashboard/campaigns/${c.id}`} className="hover:underline">
                    {c.name}
                  </Link>
                </td>
                <td className="tabular-nums px-3 py-2 text-right">{c.leads}</td>
                <td className="tabular-nums px-3 py-2 text-right">{c.spend.toFixed(0)}</td>
                <td className="tabular-nums px-3 py-2 text-right">{c.cpl?.toFixed(0) ?? "—"}</td>
              </tr>
            ))}
            {byCampaign.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-muted">
                  No leads recorded in this range yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableScroller>

      <h2 className="mb-2 text-lg font-bold">Individual Leads (CRM / Landing Page)</h2>
      <p className="mb-3 text-sm text-muted">
        Landing-page and CRM-sourced leads captured via a per-workspace webhook — see PRD Section 5.1 (dual
        ingestion: Meta Lead Forms + landing-page leads). POST JSON <code className="rounded bg-surface-raised px-1">{`{ "meta_campaign_id" or "campaign_name" }`}</code> to:
      </p>
      {webhookUrl && (
        <p className="mb-4 break-all rounded-lg border border-border bg-surface p-2 font-mono text-xs">
          {webhookUrl}
        </p>
      )}
      <TableScroller>
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead className="text-[10px] uppercase tracking-wide text-faint">
            <tr>
              <th className="px-3 py-2">Campaign</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Received</th>
              <th className="px-3 py-2">Quality</th>
            </tr>
          </thead>
          <tbody>
            {(individualLeads ?? []).map((l: Record<string, unknown>) => {
              const campaign = Array.isArray(l.campaign) ? l.campaign[0] : l.campaign;
              return (
                <tr key={l.id as string} className="border-t border-border">
                  <td className="px-3 py-2">{(campaign as { name?: string } | null)?.name ?? "—"}</td>
                  <td className="px-3 py-2">{l.source as string}</td>
                  <td className="tabular-nums px-3 py-2">{new Date(l.created_at as string).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <QualityTagSelect leadId={l.id as string} currentTag={(l.quality_tag as string) ?? null} />
                  </td>
                </tr>
              );
            })}
            {(individualLeads ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-muted">
                  No individual leads captured yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableScroller>
    </div>
  );
}
