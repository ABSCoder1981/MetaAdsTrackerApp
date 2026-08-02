import { cookies } from "next/headers";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveWorkspaceId } from "@/lib/workspace";
import { getDashboardContext } from "@/lib/dashboard/context";
import { getLatestProfitabilitySnapshots } from "@/lib/profitability/query";
import { DEFAULT_PROFITABILITY_THRESHOLDS } from "@/lib/profitability/rules";
import { CLASSIFICATION_LABEL, RECOMMENDATION_LABEL, RECOMMENDATION_CLASS } from "@/lib/profitability/labels";
import { updateProfitabilityThresholds } from "./actions";
import { TableScroller } from "@/components/TableScroller";

export default async function ProfitabilityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const cookieStore = await cookies();
  const workspaceId = await resolveActiveWorkspaceId(supabase, cookieStore.get("active_workspace_id")?.value);
  if (!workspaceId || !user) return null;

  const [context, snapshots, { data: workspaceRow }] = await Promise.all([
    getDashboardContext(supabase, workspaceId, user.id),
    getLatestProfitabilitySnapshots(supabase, workspaceId),
    supabase.from("workspace").select("profitability_thresholds").eq("id", workspaceId).single(),
  ]);

  const thresholds = { ...DEFAULT_PROFITABILITY_THRESHOLDS, ...(workspaceRow?.profitability_thresholds ?? {}) };
  const sorted = [...snapshots].sort((a, b) => a.estimatedProfitLoss - b.estimatedProfitLoss);

  return (
    <div className="max-w-4xl">
      <h1 className="mb-4 text-2xl font-bold">Profitability & Recommendations</h1>
      <p className="mb-4 text-sm text-muted">
        Deterministic, rule-based classification — the same inputs always produce the same verdict. Advisory only;
        no automatic pausing (Section 6, Out of Scope). Only Property-tagged campaigns with configured ROI
        assumptions and enough spend to clear the eligibility threshold are evaluated.
      </p>

      {context.roleName === "Administrator" && (
        <details className="mb-6 rounded-lg border border-border bg-surface p-4">
          <summary className="cursor-pointer text-sm font-medium">Threshold configuration (Admin only)</summary>
          <form action={updateProfitabilityThresholds} className="mt-3 grid max-w-md gap-3 sm:grid-cols-3">
            <label className="text-xs text-muted">
              Break-even margin %
              <input
                name="breakEvenMarginPct"
                type="number"
                step="0.1"
                defaultValue={thresholds.breakEvenMarginPct}
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
              />
            </label>
            <label className="text-xs text-muted">
              Consecutive-day threshold
              <input
                name="consecutiveDayThreshold"
                type="number"
                defaultValue={thresholds.consecutiveDayThreshold}
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
              />
            </label>
            <label className="text-xs text-muted">
              Min spend for eligibility
              <input
                name="minSpendForEligibility"
                type="number"
                defaultValue={thresholds.minSpendForEligibility}
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
              />
            </label>
            <button
              type="submit"
              className="col-span-full w-fit rounded-md bg-foreground px-3 py-1 text-sm text-background"
            >
              Save thresholds
            </button>
          </form>
        </details>
      )}

      <TableScroller>
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="text-[10px] uppercase tracking-wide text-faint">
            <tr>
              <th className="px-3 py-2">Campaign</th>
              <th className="px-3 py-2">Classification</th>
              <th className="px-3 py-2">Recommendation</th>
              <th className="px-3 py-2 text-right">Est. Profit/Loss</th>
              <th className="px-3 py-2">Reason</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <tr key={s.campaignId} className="border-t border-border">
                <td className="max-w-[180px] truncate px-3 py-2">
                  <Link href={`/dashboard/campaigns/${s.campaignId}`} className="hover:underline">
                    {s.campaignName}
                  </Link>
                </td>
                <td className="px-3 py-2">{CLASSIFICATION_LABEL[s.classification]}</td>
                <td className="px-3 py-2">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-bold ${RECOMMENDATION_CLASS[s.recommendation]}`}>
                    {RECOMMENDATION_LABEL[s.recommendation]}
                  </span>
                </td>
                <td className={`tabular-nums px-3 py-2 text-right ${s.estimatedProfitLoss >= 0 ? "text-good" : "text-bad"}`}>
                  {s.estimatedProfitLoss.toFixed(0)}
                </td>
                <td className="max-w-[260px] px-3 py-2 text-xs text-muted">{s.reason}</td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-muted">
                  No campaigns evaluated yet — tag campaigns with a Property that has ROI assumptions configured,
                  then run a sync.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableScroller>
    </div>
  );
}
