import { describe, it, expect } from "vitest";
import { resolveDateRange } from "./dateRange";

// Fixed reference "now" so tests are deterministic regardless of when they run.
const NOW = new Date("2026-07-30T12:00:00Z");

describe("resolveDateRange", () => {
  it("today: since and until are both the current date", () => {
    expect(resolveDateRange("today", NOW)).toEqual({ since: "2026-07-30", until: "2026-07-30", label: "Today" });
  });

  it("yesterday: since and until are both the previous date", () => {
    expect(resolveDateRange("yesterday", NOW)).toEqual({
      since: "2026-07-29",
      until: "2026-07-29",
      label: "Yesterday",
    });
  });

  it("last7: spans exactly 7 days (6 days back through today)", () => {
    const { since, until } = resolveDateRange("last7", NOW);
    expect(until).toBe("2026-07-30");
    expect(since).toBe("2026-07-24");
  });

  it("last30: spans exactly 30 days (29 days back through today)", () => {
    const { since, until } = resolveDateRange("last30", NOW);
    expect(until).toBe("2026-07-30");
    expect(since).toBe("2026-07-01");
  });

  it("defaults to last7 for an unrecognized or missing range key", () => {
    expect(resolveDateRange(undefined, NOW)).toEqual(resolveDateRange("last7", NOW));
    expect(resolveDateRange("bogus", NOW)).toEqual(resolveDateRange("last7", NOW));
  });

  it("produces genuinely different windows per range (regression guard for the 'same result set' bug)", () => {
    const today = resolveDateRange("today", NOW);
    const last30 = resolveDateRange("last30", NOW);
    expect(today.since).not.toBe(last30.since);
  });
});
