import { describe, it, expect } from "vitest";
import {
  classifyProfitability,
  computeDaysBelowBreakEven,
  computeRecommendation,
  buildProfitabilityReason,
} from "./rules";

describe("classifyProfitability", () => {
  it("is profitable when margin clears the break-even band", () => {
    // spend 1000, profit 200 -> +20% margin, band is ±5%
    expect(classifyProfitability(200, 1000, 5)).toBe("profitable");
  });

  it("is loss_making when margin is well below the break-even band", () => {
    expect(classifyProfitability(-200, 1000, 5)).toBe("loss_making");
  });

  it("is break_even when margin is within the band", () => {
    expect(classifyProfitability(30, 1000, 5)).toBe("break_even"); // +3%
    expect(classifyProfitability(-30, 1000, 5)).toBe("break_even"); // -3%
  });

  it("is exactly at the boundary treated as break_even, not profitable/loss (strict inequality)", () => {
    expect(classifyProfitability(50, 1000, 5)).toBe("break_even"); // exactly +5%
  });

  it("defaults to break_even for zero/negative spend (division guard)", () => {
    expect(classifyProfitability(100, 0, 5)).toBe("break_even");
  });
});

describe("computeDaysBelowBreakEven", () => {
  it("increments when today is also loss-making", () => {
    expect(computeDaysBelowBreakEven(3, true)).toBe(4);
  });

  it("resets to 0 when today is not loss-making", () => {
    expect(computeDaysBelowBreakEven(6, false)).toBe(0);
  });

  it("starts at 1 for the first loss-making day", () => {
    expect(computeDaysBelowBreakEven(0, true)).toBe(1);
  });
});

describe("computeRecommendation", () => {
  it("recommends continue for profitable campaigns", () => {
    expect(computeRecommendation("profitable", 0, 7)).toBe("continue");
  });

  it("recommends monitor for break-even campaigns", () => {
    expect(computeRecommendation("break_even", 0, 7)).toBe("monitor");
  });

  it("recommends reduce_budget for loss-making campaigns under the day threshold", () => {
    expect(computeRecommendation("loss_making", 3, 7)).toBe("reduce_budget");
  });

  it("recommends pause once loss-making days reach the threshold", () => {
    expect(computeRecommendation("loss_making", 7, 7)).toBe("pause");
  });

  it("recommends pause beyond the threshold too", () => {
    expect(computeRecommendation("loss_making", 10, 7)).toBe("pause");
  });
});

describe("buildProfitabilityReason", () => {
  it("produces a reason that mentions the actual margin for continue", () => {
    const reason = buildProfitabilityReason({
      recommendation: "continue",
      marginPct: 22,
      daysBelowBreakEven: 0,
      consecutiveDayThreshold: 7,
      breakEvenMarginPct: 5,
      cplVsBreakEvenPct: null,
    });
    expect(reason).toContain("+22%");
    expect(reason).toContain("profitable");
  });

  it("produces a reason mentioning consecutive days and threshold for pause", () => {
    const reason = buildProfitabilityReason({
      recommendation: "pause",
      marginPct: -40,
      daysBelowBreakEven: 8,
      consecutiveDayThreshold: 7,
      breakEvenMarginPct: 5,
      cplVsBreakEvenPct: 32,
    });
    expect(reason).toContain("8 consecutive days");
    expect(reason).toContain("threshold: 7");
    expect(reason).toContain("32%");
  });

  it("produces a reason for reduce_budget distinct from pause", () => {
    const reason = buildProfitabilityReason({
      recommendation: "reduce_budget",
      marginPct: -12,
      daysBelowBreakEven: 3,
      consecutiveDayThreshold: 7,
      breakEvenMarginPct: 5,
      cplVsBreakEvenPct: null,
    });
    expect(reason).toContain("3 consecutive day");
    expect(reason).toContain("below the 7-day pause threshold");
  });
});
