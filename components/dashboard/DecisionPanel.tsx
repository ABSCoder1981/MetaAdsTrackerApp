import Link from "next/link";
import type { LatestProfitabilitySnapshot } from "@/lib/profitability/query";
import { RECOMMENDATION_LABEL, RECOMMENDATION_CLASS, type ProfitabilityRecommendation } from "@/lib/profitability/labels";

const ORDER: ProfitabilityRecommendation[] = ["continue", "monitor", "reduce_budget", "pause"];

/** "What should we do today?" summary (design review item 19) — counts per
 * recommendation, plus spend currently sitting in Reduce/Pause campaigns
 * (a real number from spend_to_date, not a fabricated savings estimate). */
export function DecisionPanel({ snapshots }: { snapshots: LatestProfitabilitySnapshot[] }) {
  const byRec = new Map<ProfitabilityRecommendation, LatestProfitabilitySnapshot[]>();
  for (const rec of ORDER) byRec.set(rec, []);
  for (const s of snapshots) byRec.get(s.recommendation)?.push(s);

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-bold">Recommendations Summary</p>
        <Link href="/dashboard/profitability" className="text-xs text-muted hover:text-accent">
          View all
        </Link>
      </div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-faint">
            <th className="pb-1.5">Action</th>
            <th className="pb-1.5 text-right">Campaigns</th>
            <th className="pb-1.5 text-right">Spend involved</th>
          </tr>
        </thead>
        <tbody>
          {ORDER.map((rec) => {
            const rows = byRec.get(rec) ?? [];
            const spend = rows.reduce((sum, s) => sum + s.spendToDate, 0);
            return (
              <tr key={rec} className="border-t border-border">
                <td className="py-2">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-bold ${RECOMMENDATION_CLASS[rec]}`}>
                    {RECOMMENDATION_LABEL[rec]}
                  </span>
                </td>
                <td className="tabular-nums py-2 text-right">{rows.length}</td>
                <td className="tabular-nums py-2 text-right">{spend > 0 ? spend.toFixed(0) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
