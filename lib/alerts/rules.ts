/**
 * Alert rule checks (PRD Section 17). Each function is a pure predicate so
 * the rule logic is unit-testable without a database or the sync job.
 *
 * Implemented now (8 of 12): the ones evaluable from data this app already
 * syncs. NOT implemented — documented here rather than stubbed silently:
 *   - Learning Limited: needs ad-set-level `learning_stage_info`, which
 *     would mean syncing every ad set for every campaign daily (not just
 *     the on-demand Campaign Detail drill-down) — meaningful added API
 *     load or rate-limit risk, deferred.
 *   - Estimated ROAS dropped WoW: needed a stored daily estimated_roi
 *     history per campaign — moot now that the Property module (and its
 *     estimated-revenue computation) has been removed entirely.
 *   - Pixel inactive: needs pixel event ingestion (Meta CAPI/Pixel
 *     webhook), which isn't built at all yet.
 */

export function checkCtrBelowThreshold(recentCtrs: (number | null)[], thresholdPct: number): boolean {
  if (recentCtrs.length < 2) return false;
  const lastTwo = recentCtrs.slice(-2);
  return lastTwo.every((ctr) => ctr != null && ctr < thresholdPct);
}

export function checkCplIncreased(latestCpl: number | null, trailingAvgCpl: number | null, thresholdPct: number): boolean {
  if (latestCpl == null || trailingAvgCpl == null || trailingAvgCpl <= 0) return false;
  return ((latestCpl - trailingAvgCpl) / trailingAvgCpl) * 100 > thresholdPct;
}

export function checkBudgetExhausted(budgetRemaining: number | null, lifetimeBudget: number | null): boolean {
  if (lifetimeBudget == null || budgetRemaining == null) return false;
  return budgetRemaining <= 0;
}

/** MVP approximation: any Active→Paused transition counts as "unexpected"
 * since the app has no in-app pause action to distinguish an intentional
 * pause from an external one — see file-level note. */
export function checkCampaignStoppedUnexpectedly(previousStatus: string | null, currentStatus: string | null): boolean {
  return previousStatus === "ACTIVE" && currentStatus === "PAUSED";
}

export function checkFrequencyHigh(frequency: number | null, thresholdMax: number): boolean {
  if (frequency == null) return false;
  return frequency > thresholdMax;
}

export function checkSpendAnomaly(todaySpend: number, trailingAvgSpend: number, thresholdPct: number): boolean {
  if (trailingAvgSpend <= 0) return false;
  return Math.abs((todaySpend - trailingAvgSpend) / trailingAvgSpend) * 100 > thresholdPct;
}

export function checkLeadVolumeDropped(todayLeads: number, trailingAvgLeads: number, thresholdPct: number): boolean {
  if (trailingAvgLeads <= 0) return false;
  return ((trailingAvgLeads - todayLeads) / trailingAvgLeads) * 100 > thresholdPct;
}

export function checkCampaignRejected(effectiveStatus: string | null): boolean {
  if (!effectiveStatus) return false;
  return effectiveStatus === "DISAPPROVED" || effectiveStatus === "WITH_ISSUES";
}

export const DEFAULT_ALERT_THRESHOLDS = {
  ctrMinPct: 1.0,
  cplIncreasePct: 25,
  frequencyMax: 3.5,
  spendAnomalyPct: 40,
  leadDropPct: 30,
};
