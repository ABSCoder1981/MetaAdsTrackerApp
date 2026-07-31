/**
 * Headline KPI card with a Today-vs-Yesterday (or any two-period) delta
 * indicator (Section 9.1: "Today vs Yesterday delta on headline KPIs").
 */
export function KpiCard({
  label,
  value,
  previousValue,
  formatter = (n: number) => n.toLocaleString(),
}: {
  label: string;
  value: number;
  previousValue?: number;
  formatter?: (n: number) => string;
}) {
  const hasDelta = previousValue != null;
  const delta = hasDelta ? value - previousValue! : 0;
  const pct = hasDelta && previousValue! > 0 ? (delta / previousValue!) * 100 : null;
  const isUp = delta >= 0;

  return (
    <div className="rounded border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="text-2xl font-semibold text-black dark:text-zinc-50">{formatter(value)}</p>
      {hasDelta && (
        <p className={`text-xs ${isUp ? "text-emerald-600" : "text-red-600"}`}>
          {isUp ? "▲" : "▼"} {pct != null ? `${Math.abs(pct).toFixed(0)}%` : formatter(Math.abs(delta))} vs previous
        </p>
      )}
    </div>
  );
}
