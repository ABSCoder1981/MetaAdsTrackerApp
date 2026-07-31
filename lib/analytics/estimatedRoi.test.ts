import { describe, it, expect } from "vitest";
import { computeEstimatedRevenue, computeEstimatedRoiPct } from "./estimatedRoi";

describe("computeEstimatedRevenue", () => {
  it("computes leads * conversion rate * deal value", () => {
    // 10 leads, 20% assumed conversion, ₹500,000 avg deal → 10 * 0.2 * 500000
    expect(computeEstimatedRevenue(10, 20, 500000)).toBe(1_000_000);
  });

  it("returns null when conversion rate is not set", () => {
    expect(computeEstimatedRevenue(10, null, 500000)).toBeNull();
  });

  it("returns null when avg deal value is not set", () => {
    expect(computeEstimatedRevenue(10, 20, null)).toBeNull();
  });

  it("returns 0 for zero leads (not null — a real, computable zero)", () => {
    expect(computeEstimatedRevenue(0, 20, 500000)).toBe(0);
  });
});

describe("computeEstimatedRoiPct", () => {
  it("computes positive ROI when revenue exceeds spend", () => {
    // spend 100,000, revenue 150,000 → +50%
    expect(computeEstimatedRoiPct(100_000, 150_000)).toBe(50);
  });

  it("computes negative ROI when revenue is below spend", () => {
    expect(computeEstimatedRoiPct(100_000, 50_000)).toBe(-50);
  });

  it("returns null when estimated revenue is null (assumptions not configured)", () => {
    expect(computeEstimatedRoiPct(100_000, null)).toBeNull();
  });

  it("returns null when spend is zero (division by zero guard)", () => {
    expect(computeEstimatedRoiPct(0, 100_000)).toBeNull();
  });
});
