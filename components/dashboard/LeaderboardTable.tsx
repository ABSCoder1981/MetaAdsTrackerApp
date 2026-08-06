export type LeaderboardRow = {
  key: string;
  name: string;
  spend: number;
  leads: number;
  cpl: number | null;
};

/** Generic leaderboard (Section 11.2: City leaderboard — grouping dimension
 * supplied upstream). Ranked-list style per the confirmed dashboard design
 * (managers compare numbers faster than a donut chart). */
export function LeaderboardTable({ title, rows, limit = 5 }: { title: string; rows: LeaderboardRow[]; limit?: number }) {
  const top = [...rows].sort((a, b) => b.spend - a.spend).slice(0, limit);

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="mb-2 text-sm font-bold">{title}</p>
      {top.length === 0 ? (
        <p className="text-sm text-muted">No data in this range.</p>
      ) : (
        <div>
          <div className="grid grid-cols-[20px_1.4fr_0.8fr_0.7fr_0.7fr] gap-2 border-b border-border pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-faint">
            <span />
            <span>Name</span>
            <span className="text-right">Spend</span>
            <span className="text-right">Leads</span>
            <span className="text-right">CPL</span>
          </div>
          {top.map((r, i) => (
            <div
              key={r.key}
              className="grid grid-cols-[20px_1.4fr_0.8fr_0.7fr_0.7fr] items-center gap-2 border-b border-border py-2 text-sm last:border-b-0"
            >
              <span className="text-[11px] font-bold text-faint">{i + 1}</span>
              <span className="truncate font-medium">{r.name}</span>
              <span className="tabular-nums text-right">{r.spend.toFixed(0)}</span>
              <span className="tabular-nums text-right">{r.leads}</span>
              <span className="tabular-nums text-right">{r.cpl?.toFixed(0) ?? "—"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
