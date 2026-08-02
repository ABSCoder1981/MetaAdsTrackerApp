/**
 * Headline KPI card with a Today-vs-Yesterday (or any two-period) delta
 * indicator (Section 9.1: "Today vs Yesterday delta on headline KPIs").
 */

const ICON_TONE_CLASS = {
  1: "bg-series-1-tint text-series-1",
  2: "bg-series-2-tint text-series-2",
  3: "bg-series-3-tint text-series-3",
  4: "bg-series-4-tint text-series-4",
  status: "bg-bad-tint text-bad",
} as const;

export function KpiCard({
  label,
  value,
  previousValue,
  formatter = (n: number) => n.toLocaleString(),
  target,
  icon,
  tone,
}: {
  label: string;
  value: number;
  previousValue?: number;
  formatter?: (n: number) => string;
  /** Optional goal/target shown under the delta, e.g. "Goal 15L" or "Target 1,500". */
  target?: string;
  /** Optional icon glyph for a colored badge (e.g. "₹", "◎", "⏱"). */
  icon?: string;
  /** Categorical slot 1-4 for identity (Spend/Leads/CPL/Campaigns, fixed
   * order — never reassigned per-render), or "status" for counts that are
   * inherently a severity (e.g. Open Alerts). Ignored if `icon` is unset. */
  tone?: 1 | 2 | 3 | 4 | "status";
}) {
  const hasDelta = previousValue != null;
  const delta = hasDelta ? value - previousValue! : 0;
  const pct = hasDelta && previousValue! > 0 ? (delta / previousValue!) * 100 : null;
  const isUp = delta >= 0;
  const healthColor = !hasDelta ? "bg-faint" : isUp ? "bg-good" : "bg-bad";

  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center gap-1.5">
        {icon ? (
          <span
            className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-xs ${ICON_TONE_CLASS[tone ?? 1]}`}
          >
            {icon}
          </span>
        ) : (
          <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${healthColor}`} />
        )}
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
