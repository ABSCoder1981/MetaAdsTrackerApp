/**
 * Every ROI/ROAS/estimated-revenue surface in the app MUST render through
 * this component, never as a bare number — PRD Section 28 acceptance
 * criterion requires "Estimated" labeling with the underlying assumption
 * visible on hover, everywhere it appears. Pure CSS hover (no client JS
 * needed) so this stays a Server Component and can be dropped in anywhere.
 */
export function EstimatedValue({
  value,
  formatter,
  assumedConversionRatePct,
  assumedAvgDealValue,
}: {
  value: number | null;
  formatter: (n: number) => string;
  assumedConversionRatePct: number | null;
  assumedAvgDealValue: number | null;
}) {
  if (value == null) {
    return <span className="text-faint" title="Set assumed conversion rate & avg deal value for this property to compute">—</span>;
  }

  const assumptionText =
    assumedConversionRatePct != null && assumedAvgDealValue != null
      ? `Assumes ${assumedConversionRatePct}% conversion rate × ₹${assumedAvgDealValue.toLocaleString()} avg deal value`
      : "Assumptions not configured";

  return (
    <span className="group relative inline-flex cursor-help items-center gap-1">
      <span className="text-[10px] font-bold uppercase tracking-wide text-warn">Est.</span>
      <span className="tabular-nums">{formatter(value)}</span>
      <span className="pointer-events-none absolute bottom-full left-0 z-10 mb-1 hidden w-56 rounded-md bg-foreground px-2 py-1 text-xs font-normal normal-case text-background group-hover:block">
        {assumptionText} — not confirmed revenue.
      </span>
    </span>
  );
}
