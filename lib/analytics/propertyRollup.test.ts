import { describe, it, expect } from "vitest";
import { rollupByProperty } from "./propertyRollup";

describe("rollupByProperty", () => {
  it("sums metrics across multiple campaigns belonging to the same property", () => {
    const campaigns = [
      { id: "c1", propertyId: "p1" },
      { id: "c2", propertyId: "p1" },
      { id: "c3", propertyId: "p2" },
    ];
    const metrics = new Map([
      ["c1", { totalSpend: 100, totalImpressions: 1000, totalLeads: 2 }],
      ["c2", { totalSpend: 200, totalImpressions: 2000, totalLeads: 3 }],
      ["c3", { totalSpend: 50, totalImpressions: 500, totalLeads: 0 }],
    ]);

    const result = rollupByProperty(campaigns, metrics);

    const p1 = result.find((r) => r.propertyId === "p1");
    expect(p1).toEqual({ propertyId: "p1", spend: 300, impressions: 3000, leads: 5, cpl: 60 });

    const p2 = result.find((r) => r.propertyId === "p2");
    expect(p2).toEqual({ propertyId: "p2", spend: 50, impressions: 500, leads: 0, cpl: null });
  });

  it("groups untagged campaigns (null propertyId) together", () => {
    const campaigns = [
      { id: "c1", propertyId: null },
      { id: "c2", propertyId: null },
    ];
    const metrics = new Map([
      ["c1", { totalSpend: 10, totalImpressions: 100, totalLeads: 1 }],
      ["c2", { totalSpend: 20, totalImpressions: 200, totalLeads: 1 }],
    ]);

    const result = rollupByProperty(campaigns, metrics);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ propertyId: null, spend: 30, impressions: 300, leads: 2, cpl: 15 });
  });

  it("skips campaigns with no metrics for the selected range", () => {
    const campaigns = [{ id: "c1", propertyId: "p1" }];
    const metrics = new Map<string, { totalSpend: number; totalImpressions: number; totalLeads: number }>();

    const result = rollupByProperty(campaigns, metrics);
    expect(result).toHaveLength(0);
  });

  it("returns null cpl (not zero or NaN) when leads is zero", () => {
    const campaigns = [{ id: "c1", propertyId: "p1" }];
    const metrics = new Map([["c1", { totalSpend: 500, totalImpressions: 1000, totalLeads: 0 }]]);

    const result = rollupByProperty(campaigns, metrics);
    expect(result[0].cpl).toBeNull();
  });
});
