/**
 * Estimated ROI computation (PRD Section 5.1 / 13.4). True ROAS is
 * unmeasurable until deeper CRM integration exists (Phase 2), so this uses
 * an editable assumed conversion rate + average deal value per property.
 * Every caller MUST render the result through <EstimatedValue> — never as
 * a bare number — per the Section 28 acceptance criterion that "Estimated"
 * labeling is visible everywhere this appears.
 */
export function computeEstimatedRevenue(
  leads: number,
  assumedConversionRatePct: number | null,
  assumedAvgDealValue: number | null
): number | null {
  if (assumedConversionRatePct == null || assumedAvgDealValue == null) return null;
  return leads * (assumedConversionRatePct / 100) * assumedAvgDealValue;
}

/** Returns ROI as a percentage, e.g. 42.5 means +42.5%. */
export function computeEstimatedRoiPct(spend: number, estimatedRevenue: number | null): number | null {
  if (estimatedRevenue == null || spend <= 0) return null;
  return ((estimatedRevenue - spend) / spend) * 100;
}
