/**
 * Headline KPI card with a Today-vs-Yesterday (or any two-period) delta
 * indicator (Section 9.1: "Today vs Yesterday delta on headline KPIs").
 */
export function KpiCard({
  label,
  value,
  previousValue,
  formatter = (n: number) => n.toLocaleString(),
  target,
}: {
  label: string;
  value: number;
  previousValue?: number;
  formatter?: (n: number) => string;
  /** Optional goal/target shown under the delta, e.g. "Goal 15L" or "Target 1,500". */
  target?: string;
}) {
  const hasDelta = previousValue != null;
  const delta = hasDelta ? value - previousValue! : 0;
  const pct = hasDelta && previousValue! > 0 ? (delta / previousValue!) * 100 : null;
  const isUp = delta >= 0;
  const healthColor = !hasDelta ? "bg-faint" : isUp ? "bg-good" : "bg-bad";

  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${healthColor}`} />
        <p className="text-[11px] text-muted">{label}</p>
      </div>
      <p className="tabular-nums mt-1 text-[19px] font-bold tracking-tight">{formatter(value)}</p>
      <div className="mt-1 flex items-center gap-1.5 text-[11px]">
        {hasDelta && (
          <span className={`font-bold ${isUp ? "text-good" : "text-bad"}`}>
            {isUp ? "▲" : "▼"} {pct != null ? `${Math.abs(pct).toFixed(0)}%` : formatter(Math.abs(delta))}
          </span>
        )}
        {target && <span className="text-faint">{target}</span>}
      </div>
    </div>
  );
}
