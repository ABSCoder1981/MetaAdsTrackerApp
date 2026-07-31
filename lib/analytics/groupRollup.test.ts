import { describe, it, expect } from "vitest";
import { rollupByKey } from "./groupRollup";

describe("rollupByKey", () => {
  it("sums metrics across campaigns sharing the same key", () => {
    const campaigns = [
      { id: "c1", key: "Pune" },
      { id: "c2", key: "Pune" },
      { id: "c3", key: "Mumbai" },
    ];
    const metrics = new Map([
      ["c1", { totalSpend: 100, totalImpressions: 1000, totalLeads: 2 }],
      ["c2", { totalSpend: 200, totalImpressions: 2000, totalLeads: 3 }],
      ["c3", { totalSpend: 50, totalImpressions: 500, totalLeads: 1 }],
    ]);

    const result = rollupByKey(campaigns, metrics);

    const pune = result.find((r) => r.key === "Pune");
    expect(pune).toEqual({ key: "Pune", spend: 300, impressions: 3000, leads: 5, cpl: 60 });
  });

  it("works with non-string keys (e.g. manager IDs)", () => {
    const campaigns = [{ id: "c1", key: "manager-uuid-1" }];
    const metrics = new Map([["c1", { totalSpend: 500, totalImpressions: 100, totalLeads: 5 }]]);

    const result = rollupByKey(campaigns, metrics);
    expect(result).toEqual([{ key: "manager-uuid-1", spend: 500, impressions: 100, leads: 5, cpl: 100 }]);
  });

  it("skips campaigns with no metrics for the range", () => {
    const campaigns = [{ id: "c1", key: "x" }];
    const metrics = new Map<string, { totalSpend: number; totalImpressions: number; totalLeads: number }>();
    expect(rollupByKey(campaigns, metrics)).toEqual([]);
  });
});
