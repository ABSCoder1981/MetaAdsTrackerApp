import { describe, it, expect } from "vitest";
import {
  checkCtrBelowThreshold,
  checkCplIncreased,
  checkBudgetExhausted,
  checkCampaignStoppedUnexpectedly,
  checkFrequencyHigh,
  checkSpendAnomaly,
  checkLeadVolumeDropped,
  checkCampaignRejected,
} from "./rules";

describe("checkCtrBelowThreshold", () => {
  it("fires when the last 2 days are both below threshold", () => {
    expect(checkCtrBelowThreshold([2, 0.5, 0.4], 1.0)).toBe(true);
  });

  it("does not fire when only 1 of the last 2 days is below threshold", () => {
    expect(checkCtrBelowThreshold([2, 0.4, 1.5], 1.0)).toBe(false);
  });

  it("does not fire with fewer than 2 days of data", () => {
    expect(checkCtrBelowThreshold([0.4], 1.0)).toBe(false);
  });

  it("treats a null CTR day as not-below (missing data isn't a violation)", () => {
    expect(checkCtrBelowThreshold([0.4, null], 1.0)).toBe(false);
  });
});

describe("checkCplIncreased", () => {
  it("fires when CPL rises more than the threshold vs trailing average", () => {
    expect(checkCplIncreased(150, 100, 25)).toBe(true); // +50%
  });

  it("does not fire for an increase within threshold", () => {
    expect(checkCplIncreased(110, 100, 25)).toBe(false); // +10%
  });

  it("does not fire when trailing average is zero (no baseline)", () => {
    expect(checkCplIncreased(100, 0, 25)).toBe(false);
  });

  it("does not fire when either value is null", () => {
    expect(checkCplIncreased(null, 100, 25)).toBe(false);
    expect(checkCplIncreased(100, null, 25)).toBe(false);
  });
});

describe("checkBudgetExhausted", () => {
  it("fires when remaining budget is zero", () => {
    expect(checkBudgetExhausted(0, 10000)).toBe(true);
  });

  it("fires when remaining budget is negative (overspend)", () => {
    expect(checkBudgetExhausted(-50, 10000)).toBe(true);
  });

  it("does not fire when budget remains", () => {
    expect(checkBudgetExhausted(500, 10000)).toBe(false);
  });

  it("does not fire when there's no lifetime budget configured", () => {
    expect(checkBudgetExhausted(0, null)).toBe(false);
  });
});

describe("checkCampaignStoppedUnexpectedly", () => {
  it("fires on an Active to Paused transition", () => {
    expect(checkCampaignStoppedUnexpectedly("ACTIVE", "PAUSED")).toBe(true);
  });

  it("does not fire if it was already paused", () => {
    expect(checkCampaignStoppedUnexpectedly("PAUSED", "PAUSED")).toBe(false);
  });

  it("does not fire for a new campaign with no previous status", () => {
    expect(checkCampaignStoppedUnexpectedly(null, "PAUSED")).toBe(false);
  });
});

describe("checkFrequencyHigh", () => {
  it("fires above the threshold", () => {
    expect(checkFrequencyHigh(4, 3.5)).toBe(true);
  });

  it("does not fire at or below the threshold", () => {
    expect(checkFrequencyHigh(3.5, 3.5)).toBe(false);
  });
});

describe("checkSpendAnomaly", () => {
  it("fires on a spend spike beyond threshold", () => {
    expect(checkSpendAnomaly(200, 100, 40)).toBe(true); // +100%
  });

  it("fires on a spend collapse beyond threshold (either direction)", () => {
    expect(checkSpendAnomaly(20, 100, 40)).toBe(true); // -80%
  });

  it("does not fire within threshold", () => {
    expect(checkSpendAnomaly(120, 100, 40)).toBe(false); // +20%
  });
});

describe("checkLeadVolumeDropped", () => {
  it("fires when leads drop more than threshold vs trailing average", () => {
    expect(checkLeadVolumeDropped(3, 10, 30)).toBe(true); // -70%
  });

  it("does not fire for a smaller drop", () => {
    expect(checkLeadVolumeDropped(8, 10, 30)).toBe(false); // -20%
  });

  it("does not fire on a lead increase", () => {
    expect(checkLeadVolumeDropped(15, 10, 30)).toBe(false);
  });
});

describe("checkCampaignRejected", () => {
  it("fires for DISAPPROVED", () => {
    expect(checkCampaignRejected("DISAPPROVED")).toBe(true);
  });

  it("fires for WITH_ISSUES", () => {
    expect(checkCampaignRejected("WITH_ISSUES")).toBe(true);
  });

  it("does not fire for ACTIVE", () => {
    expect(checkCampaignRejected("ACTIVE")).toBe(false);
  });

  it("does not fire for null", () => {
    expect(checkCampaignRejected(null)).toBe(false);
  });
});
