import { describe, it, expect } from "vitest";
import {
  computeLifetimeBudgetUtilizationPct,
  computeDailyBudgetUtilizationPct,
  computeDaysUntilExhaustion,
  computePacingStatus,
} from "./budgetPacing";

describe("computeLifetimeBudgetUtilizationPct", () => {
  it("computes percentage spent of a lifetime budget", () => {
    expect(computeLifetimeBudgetUtilizationPct(10000, 4000)).toBe(60);
  });

  it("returns null when lifetime budget is not set", () => {
    expect(computeLifetimeBudgetUtilizationPct(null, 4000)).toBeNull();
  });

  it("returns null when remaining is not set", () => {
    expect(computeLifetimeBudgetUtilizationPct(10000, null)).toBeNull();
  });

  it("returns null for a zero or negative budget (division guard)", () => {
    expect(computeLifetimeBudgetUtilizationPct(0, 0)).toBeNull();
  });
});

describe("computeDailyBudgetUtilizationPct", () => {
  it("computes today's spend as a percentage of the daily budget", () => {
    expect(computeDailyBudgetUtilizationPct(1000, 750)).toBe(75);
  });

  it("returns null when daily budget is not set", () => {
    expect(computeDailyBudgetUtilizationPct(null, 750)).toBeNull();
  });

  it("can exceed 100% (overspend is a real, representable state)", () => {
    expect(computeDailyBudgetUtilizationPct(1000, 1200)).toBe(120);
  });
});

describe("computeDaysUntilExhaustion", () => {
  it("divides remaining budget by average daily spend", () => {
    expect(computeDaysUntilExhaustion(1000, 100)).toBe(10);
  });

  it("returns null when there's no remaining budget tracked", () => {
    expect(computeDaysUntilExhaustion(null, 100)).toBeNull();
  });

  it("returns null when avg daily spend is zero (would be Infinity)", () => {
    expect(computeDaysUntilExhaustion(1000, 0)).toBeNull();
  });
});

describe("computePacingStatus", () => {
  it("is on_track when recent spend is within ±20% of prior", () => {
    expect(computePacingStatus(105, 100)).toBe("on_track");
    expect(computePacingStatus(85, 100)).toBe("on_track");
  });

  it("is ahead when recent spend is notably higher than prior", () => {
    expect(computePacingStatus(150, 100)).toBe("ahead");
  });

  it("is behind when recent spend is notably lower than prior", () => {
    expect(computePacingStatus(50, 100)).toBe("behind");
  });

  it("is ahead when there was no prior spend but there is recent spend", () => {
    expect(computePacingStatus(100, 0)).toBe("ahead");
  });

  it("is on_track when both periods have zero spend", () => {
    expect(computePacingStatus(0, 0)).toBe("on_track");
  });
});
