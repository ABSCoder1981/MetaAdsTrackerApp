import Link from "next/link";
import type { LatestProfitabilitySnapshot } from "@/lib/profitability/query";
import { RECOMMENDATION_LABEL, RECOMMENDATION_CLASS } from "@/lib/profitability/labels";

/** Section 11.2/11.3: "Profitability & Continue/Pause recommendation
 * panel" — surfaces campaigns needing a call, reason included, not just a
 * classification. */
export function ProfitabilityPanel({ snapshots, limit = 5 }: { snapshots: LatestProfitabilitySnapshot[]; limit?: number }) {
  const needsAttention = snapshots
    .filter((s) => s.recommendation === "reduce_budget" || s.recommendation === "pause")
    .sort((a, b) => a.estimatedProfitLoss - b.estimatedProfitLoss)
    .slice(0, limit);

  return (
    <div className="rounded border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-black dark:text-zinc-50">Continue / Pause Recommendations</p>
        <Link href="/dashboard/profitability" className="text-xs text-zinc-500 underline">
          View all
        </Link>
      </div>
      {needsAttention.length === 0 ? (
        <p className="text-sm text-zinc-500">No campaigns currently flagged for budget reduction or pause.</p>
      ) : (
        <ul className="space-y-2">
          {needsAttention.map((s) => (
            <li key={s.campaignId} className="text-sm">
              <div className="flex items-center gap-2">
                <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${RECOMMENDATION_CLASS[s.recommendation]}`}>
                  {RECOMMENDATION_LABEL[s.recommendation]}
                </span>
                <Link href={`/dashboard/campaigns/${s.campaignId}`} className="truncate hover:underline">
                  {s.campaignName}
                </Link>
              </div>
              <p className="text-xs text-zinc-500">{s.reason}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
