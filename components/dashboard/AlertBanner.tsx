import Link from "next/link";
import { RULE_LABELS } from "@/lib/alerts/labels";
import type { AlertPanelRow } from "./AlertPanel";

/** Prominent, top-of-dashboard banner for red-severity alerts (design
 * review item: alerts should be impossible to miss, not buried in a card
 * among everything else). Renders nothing when there's nothing critical —
 * AlertPanel below still covers the full list including ambers. */
export function AlertBanner({ alerts }: { alerts: AlertPanelRow[] }) {
  const critical = alerts.filter((a) => a.severity === "red");
  if (critical.length === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-bad border-l-[3px] bg-bad-tint px-4 py-2.5">
      <span className="flex items-center gap-1.5 text-sm font-bold text-bad">
        🚨 {critical.length} critical alert{critical.length === 1 ? "" : "s"}
      </span>
      {critical.slice(0, 3).map((a) => (
        <span key={a.id} className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs">
          {RULE_LABELS[a.ruleKey] ?? a.ruleKey} — {a.name}
        </span>
      ))}
      <Link href="/dashboard/alerts" className="ml-auto text-xs font-semibold text-bad hover:underline">
        View all →
      </Link>
    </div>
  );
}
