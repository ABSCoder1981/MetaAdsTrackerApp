export type HealthStatus = "green" | "amber" | "red" | "paused";

/**
 * MVP health heuristic (PRD Section 9.2: "computed from CTR, frequency, and
 * pacing thresholds"). Deliberately simple and hardcoded for now — Sprint 5
 * (Epic E, Section 17) replaces this with the real per-workspace
 * configurable alert rule engine. This function is the placeholder that
 * DoD explicitly allows ("thresholds configurable per workspace" is a
 * Sprint 5 deliverable, not a Sprint 3 one).
 */
export function computeHealthStatus(input: {
  status: string | null;
  ctr: number | null;
  frequency: number | null;
  spend: number;
  impressions: number;
  leads: number;
}): HealthStatus {
  const status = (input.status ?? "").toUpperCase();
  if (status && status !== "ACTIVE") return "paused";

  const ctr = input.ctr ?? 0;
  const frequency = input.frequency ?? 0;

  if (ctr < 0.5 || frequency > 4.5) return "red";
  if (input.spend > 500 && input.impressions > 1000 && input.leads === 0) return "red";
  if (ctr < 1 || frequency > 3.5) return "amber";
  return "green";
}

export const HEALTH_LABEL: Record<HealthStatus, string> = {
  green: "Healthy",
  amber: "Needs attention",
  red: "Critical",
  paused: "Paused",
};

export const HEALTH_DOT_CLASS: Record<HealthStatus, string> = {
  green: "bg-good",
  amber: "bg-warn",
  red: "bg-bad",
  paused: "bg-faint",
};
