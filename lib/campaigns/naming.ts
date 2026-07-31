/**
 * Best-effort parser for the recommended naming convention (PRD Section
 * 5.1): "[Manager] - [Client/Property] [Objective] Campaign [Month-Year]".
 * Real synced campaign names match this loosely — e.g. "Atik - Kolte Patil
 * Leads Campaign Jul-26" — so this is a heuristic, not a strict grammar.
 * Campaigns that don't match return null and fall back to manual tagging
 * (Section 9.2's bulk-tagging UI), exactly as the PRD anticipates.
 */
const NAMING_PATTERN = /^(.+?)\s-\s(.+?)\s+(\S+)\s+Campaign\s+(\S+)$/i;

export type ParsedCampaignName = {
  managerName: string;
  propertyName: string;
  objectiveHint: string;
  monthYear: string;
};

export function parseCampaignName(name: string): ParsedCampaignName | null {
  const match = name.match(NAMING_PATTERN);
  if (!match) return null;

  const [, managerName, propertyName, objectiveHint, monthYear] = match;
  return {
    managerName: managerName.trim(),
    propertyName: propertyName.trim(),
    objectiveHint: objectiveHint.trim(),
    monthYear: monthYear.trim(),
  };
}
