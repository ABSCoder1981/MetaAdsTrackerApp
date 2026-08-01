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
  continue: "bg-good-tint text-good",
  monitor: "bg-warn-tint text-warn",
  reduce_budget: "bg-reduce-tint text-reduce",
  pause: "bg-bad-tint text-bad",
};
