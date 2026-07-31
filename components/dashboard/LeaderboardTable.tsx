export type LeaderboardRow = {
  key: string;
  name: string;
  spend: number;
  leads: number;
  cpl: number | null;
};

/** Generic leaderboard (Section 11.2: Property/City/Manager leaderboards —
 * same shape, different grouping dimension upstream). */
export function LeaderboardTable({ title, rows, limit = 5 }: { title: string; rows: LeaderboardRow[]; limit?: number }) {
  const top = [...rows].sort((a, b) => b.spend - a.spend).slice(0, limit);

  return (
    <div className="rounded border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="mb-2 text-sm font-semibold text-black dark:text-zinc-50">{title}</p>
      {top.length === 0 ? (
        <p className="text-sm text-zinc-500">No data in this range.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-zinc-500">
            <tr>
              <th className="py-1">Name</th>
              <th className="py-1 text-right">Spend</th>
              <th className="py-1 text-right">Leads</th>
              <th className="py-1 text-right">CPL</th>
            </tr>
          </thead>
          <tbody>
            {top.map((r) => (
              <tr key={r.key} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="max-w-[160px] truncate py-1">{r.name}</td>
                <td className="py-1 text-right">{r.spend.toFixed(0)}</td>
                <td className="py-1 text-right">{r.leads}</td>
                <td className="py-1 text-right">{r.cpl?.toFixed(0) ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
