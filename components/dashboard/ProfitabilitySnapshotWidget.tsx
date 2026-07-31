import type { LatestProfitabilitySnapshot } from "@/lib/profitability/query";

/** Section 11.1: CEO Dashboard "Profitability snapshot (Profitable /
 * Break-even / Loss-making campaign counts)." */
export function ProfitabilitySnapshotWidget({ snapshots }: { snapshots: LatestProfitabilitySnapshot[] }) {
  const counts = { profitable: 0, break_even: 0, loss_making: 0 };
  for (const s of snapshots) counts[s.classification]++;

  return (
    <div className="rounded border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="mb-2 text-sm font-semibold text-black dark:text-zinc-50">Profitability Snapshot</p>
      {snapshots.length === 0 ? (
        <p className="text-sm text-zinc-500">No campaigns evaluated yet.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-2xl font-semibold text-emerald-600">{counts.profitable}</p>
            <p className="text-xs text-zinc-500">Profitable</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-zinc-500">{counts.break_even}</p>
            <p className="text-xs text-zinc-500">Break-even</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-red-600">{counts.loss_making}</p>
            <p className="text-xs text-zinc-500">Loss-making</p>
          </div>
        </div>
      )}
    </div>
  );
}
