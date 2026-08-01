import type { LatestProfitabilitySnapshot } from "@/lib/profitability/query";

/** Section 11.1: CEO Dashboard "Profitability snapshot (Profitable /
 * Break-even / Loss-making campaign counts)." */
export function ProfitabilitySnapshotWidget({ snapshots }: { snapshots: LatestProfitabilitySnapshot[] }) {
  const counts = { profitable: 0, break_even: 0, loss_making: 0 };
  for (const s of snapshots) counts[s.classification]++;

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="mb-2 text-sm font-bold">Profitability Snapshot</p>
      {snapshots.length === 0 ? (
        <p className="text-sm text-muted">No campaigns evaluated yet.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="tabular-nums text-2xl font-bold text-good">{counts.profitable}</p>
            <p className="text-xs text-muted">Profitable</p>
          </div>
          <div>
            <p className="tabular-nums text-2xl font-bold text-warn">{counts.break_even}</p>
            <p className="text-xs text-muted">Break-even</p>
          </div>
          <div>
            <p className="tabular-nums text-2xl font-bold text-bad">{counts.loss_making}</p>
            <p className="text-xs text-muted">Loss-making</p>
          </div>
        </div>
      )}
    </div>
  );
}
