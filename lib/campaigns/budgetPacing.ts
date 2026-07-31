/**
 * Budget Tracking & Pacing math (PRD Section 9.8). MVP scope: linear
 * projection only — Phase 2 upgrades this to seasonality-aware forecasting
 * (Section 24). Lifetime and daily budgets are modeled separately because
 * Meta reports them differently: `budget_remaining` is meaningful for
 * lifetime budgets (it depletes over the campaign's life), but daily
 * budgets reset every day, so "remaining" only makes sense within today.
 */

export type PacingStatus = "ahead" | "on_track" | "behind";

export function computeLifetimeBudgetUtilizationPct(
  lifetimeBudget: number | null,
  budgetRemaining: number | null
): number | null {
  if (lifetimeBudget == null || budgetRemaining == null || lifetimeBudget <= 0) return null;
  return ((lifetimeBudget - budgetRemaining) / lifetimeBudget) * 100;
}

export function computeDailyBudgetUtilizationPct(dailyBudget: number | null, todaySpend: number): number | null {
  if (dailyBudget == null || dailyBudget <= 0) return null;
  return (todaySpend / dailyBudget) * 100;
}

/** Simple linear projection: at the current average daily spend, how many
 * days until the remaining budget runs out. */
export function computeDaysUntilExhaustion(budgetRemaining: number | null, avgDailySpend: number): number | null {
  if (budgetRemaining == null || avgDailySpend <= 0) return null;
  return budgetRemaining / avgDailySpend;
}

/**
 * Compares recent spend velocity to the prior period's to flag whether a
 * campaign is pacing ahead of, on track with, or behind its recent trend.
 * A ±20% band is treated as "on track" to avoid flagging normal day-to-day
 * noise as a pacing problem.
 */
export function computePacingStatus(recentAvgSpend: number, priorAvgSpend: number): PacingStatus {
  if (priorAvgSpend <= 0) return recentAvgSpend > 0 ? "ahead" : "on_track";
  const ratio = recentAvgSpend / priorAvgSpend;
  if (ratio > 1.2) return "ahead";
  if (ratio < 0.8) return "behind";
  return "on_track";
}
