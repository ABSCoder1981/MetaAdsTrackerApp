import type { ProfitabilityClassification, ProfitabilityRecommendation } from "./rules";

export type { ProfitabilityClassification, ProfitabilityRecommendation };

export const CLASSIFICATION_LABEL: Record<ProfitabilityClassification, string> = {
  profitable: "Profitable",
  break_even: "Break-even",
  loss_making: "Loss-making",
};

export const RECOMMENDATION_LABEL: Record<ProfitabilityRecommendation, string> = {
  continue: "Continue",
  monitor: "Monitor",
  reduce_budget: "Reduce Budget",
  pause: "Pause",
};

export const RECOMMENDATION_CLASS: Record<ProfitabilityRecommendation, string> = {
  continue: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  monitor: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  reduce_budget: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  pause: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
};
