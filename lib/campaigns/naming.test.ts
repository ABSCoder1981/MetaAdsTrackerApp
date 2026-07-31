import { describe, it, expect } from "vitest";
import { parseCampaignName } from "./naming";

describe("parseCampaignName", () => {
  it("parses a real synced campaign name", () => {
    expect(parseCampaignName("Atik - Kolte Patil Leads Campaign Jul-26")).toEqual({
      managerName: "Atik",
      propertyName: "Kolte Patil",
      objectiveHint: "Leads",
      monthYear: "Jul-26",
    });
  });

  it("parses a manager name containing spaces", () => {
    expect(parseCampaignName("New Kolate Patil - Gopal Leads Campaign July-26")).toEqual({
      managerName: "New Kolate Patil",
      propertyName: "Gopal",
      objectiveHint: "Leads",
      monthYear: "July-26",
    });
  });

  it("parses a property name containing multiple words", () => {
    expect(parseCampaignName("Nanded City Lokmat Press - Gopal Leads Campaign Mar-26")).toEqual({
      managerName: "Nanded City Lokmat Press",
      propertyName: "Gopal",
      objectiveHint: "Leads",
      monthYear: "Mar-26",
    });
  });

  it("returns null for names without a manager prefix (no ' - ')", () => {
    expect(parseCampaignName("Kolte Patil Launch Leads Campaign Jul-26")).toBeNull();
  });

  it("returns null for names that don't end in 'Campaign <MonthYear>'", () => {
    expect(parseCampaignName("1BHK Kanifnath Society")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(parseCampaignName("")).toBeNull();
  });
});
