import { describe, it, expect } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("renders header and rows in column order", () => {
    const rows = [
      { name: "Campaign A", spend: 100 },
      { name: "Campaign B", spend: 250 },
    ];
    const csv = toCsv(rows, [
      { key: "name", label: "Campaign" },
      { key: "spend", label: "Spend" },
    ]);
    expect(csv).toBe("Campaign,Spend\r\nCampaign A,100\r\nCampaign B,250");
  });

  it("quotes cells containing commas, quotes, or newlines", () => {
    const rows = [{ name: 'Campaign, "Big" Launch\nPhase 2' }];
    const csv = toCsv(rows, [{ key: "name", label: "Campaign" }]);
    expect(csv).toBe('Campaign\r\n"Campaign, ""Big"" Launch\nPhase 2"');
  });

  it("renders null/undefined as empty cells", () => {
    const rows = [{ name: "X", cpl: null as number | null }];
    const csv = toCsv(rows, [
      { key: "name", label: "Name" },
      { key: "cpl", label: "CPL" },
    ]);
    expect(csv).toBe("Name,CPL\r\nX,");
  });
});
