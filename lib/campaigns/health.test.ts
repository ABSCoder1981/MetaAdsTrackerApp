import { describe, it, expect } from "vitest";
import { computeHealthStatus } from "./health";

describe("computeHealthStatus", () => {
  it("marks non-ACTIVE campaigns as paused regardless of metrics", () => {
    expect(
      computeHealthStatus({ status: "PAUSED", ctr: 5, frequency: 1, spend: 0, impressions: 0, leads: 0 })
    ).toBe("paused");
  });

  it("treats a null/empty status as active (evaluates metrics normally)", () => {
    expect(computeHealthStatus({ status: null, ctr: 2, frequency: 1, spend: 100, impressions: 5000, leads: 3 })).toBe(
      "green"
    );
  });

  it("is green for healthy CTR and frequency", () => {
    expect(
      computeHealthStatus({ status: "ACTIVE", ctr: 1.5, frequency: 1.2, spend: 100, impressions: 5000, leads: 2 })
    ).toBe("green");
  });

  it("is amber for borderline CTR", () => {
    expect(
      computeHealthStatus({ status: "ACTIVE", ctr: 0.8, frequency: 1.2, spend: 100, impressions: 5000, leads: 2 })
    ).toBe("amber");
  });

  it("is amber for elevated frequency", () => {
    expect(
      computeHealthStatus({ status: "ACTIVE", ctr: 1.5, frequency: 4, spend: 100, impressions: 5000, leads: 2 })
    ).toBe("amber");
  });

  it("is red for very low CTR", () => {
    expect(
      computeHealthStatus({ status: "ACTIVE", ctr: 0.2, frequency: 1.2, spend: 100, impressions: 5000, leads: 2 })
    ).toBe("red");
  });

  it("is red for very high frequency (ad fatigue)", () => {
    expect(
      computeHealthStatus({ status: "ACTIVE", ctr: 1.5, frequency: 5, spend: 100, impressions: 5000, leads: 2 })
    ).toBe("red");
  });

  it("is red for meaningful spend with zero leads (wasted spend signal)", () => {
    expect(
      computeHealthStatus({ status: "ACTIVE", ctr: 1.5, frequency: 1.2, spend: 1000, impressions: 5000, leads: 0 })
    ).toBe("red");
  });

  it("does not flag zero leads as red when spend/impressions are too low to be meaningful", () => {
    expect(
      computeHealthStatus({ status: "ACTIVE", ctr: 1.5, frequency: 1.2, spend: 10, impressions: 100, leads: 0 })
    ).toBe("green");
  });
});
