/**
 * Campaign Profitability & Continue/Pause Advisor (PRD Section 9.10).
 * Deterministic, rule-based — same inputs always produce the same verdict
 * (Section 28 acceptance criterion), no external AI/LLM call (Section 23,
 * Appendix 29.1 "Profitability advisor" decision).
 */

export type ProfitabilityClassification = "profitable" | "break_even" | "loss_making";
export type ProfitabilityRecommendation = "continue" | "monitor" | "reduce_budget" | "pause";

export const DEFAULT_PROFITABILITY_THRESHOLDS = {
  /** ±this margin % around 0 counts as "break-even" rather than a hard profit/loss call. */
  breakEvenMarginPct: 5,
  /** Consecutive loss-making evaluation runs before "Pause" replaces "Reduce Budget". */
  consecutiveDayThreshold: 7,
  /** Campaigns with less than this total spend are not eligible for a verdict yet. */
  minSpendForEligibility: 1000,
};

export function classifyProfitability(estimatedProfitLoss: number, spend: number, breakEvenMarginPct: number): ProfitabilityClassification {
  if (spend <= 0) return "break_even";
  const marginPct = (estimatedProfitLoss / spend) * 100;
  if (marginPct > breakEvenMarginPct) return "profitable";
  if (marginPct < -breakEvenMarginPct) return "loss_making";
  return "break_even";
}

/** Consecutive-day counter (Section 13.7) — a run of back-to-back
 * loss-making evaluations. Resets to 0 the moment a run isn't loss-making. */
export function computeDaysBelowBreakEven(previousConsecutiveDays: number, isLossMakingToday: boolean): number {
  return isLossMakingToday ? previousConsecutiveDays + 1 : 0;
}

export function computeRecommendation(
  classification: ProfitabilityClassification,
  daysBelowBreakEven: number,
  consecutiveDayThreshold: number
): ProfitabilityRecommendation {
  if (classification === "profitable") return "continue";
  if (classification === "break_even") return "monitor";
  return daysBelowBreakEven >= consecutiveDayThreshold ? "pause" : "reduce_budget";
}

/**
 * Plain-language reason built from the specific numbers that produced the
 * verdict — templated, not AI-generated (PRD explicitly requires this
 * distinction), so it's always traceable back to the exact inputs.
 */
export function buildProfitabilityReason(input: {
  recommendation: ProfitabilityRecommendation;
  marginPct: number;
  daysBelowBreakEven: number;
  consecutiveDayThreshold: number;
  breakEvenMarginPct: number;
  cplVsBreakEvenPct: number | null;
}): string {
  const { recommendation, marginPct, daysBelowBreakEven, consecutiveDayThreshold, breakEvenMarginPct, cplVsBreakEvenPct } = input;
  const marginStr = `${marginPct >= 0 ? "+" : ""}${marginPct.toFixed(0)}%`;

  switch (recommendation) {
    case "continue":
      return `Estimated Profit/Loss positive (${marginStr} margin) — campaign is profitable.`;
    case "monitor":
      return `Estimated Profit/Loss within ±${breakEvenMarginPct}% of break-even (${marginStr} margin) — monitor before acting.`;
    case "reduce_budget": {
      const cplNote = cplVsBreakEvenPct != null ? ` CPL ${cplVsBreakEvenPct.toFixed(0)}% above break-even.` : "";
      return `Estimated Profit/Loss negative (${marginStr} margin) for ${daysBelowBreakEven} consecutive day(s) — below the ${consecutiveDayThreshold}-day pause threshold.${cplNote}`;
    }
    case "pause": {
      const cplNote = cplVsBreakEvenPct != null ? ` CPL ${cplVsBreakEvenPct.toFixed(0)}% above break-even threshold.` : "";
      return `Estimated Profit/Loss negative for ${daysBelowBreakEven} consecutive days (threshold: ${consecutiveDayThreshold}).${cplNote}`;
    }
  }
}
