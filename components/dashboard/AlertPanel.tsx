import Link from "next/link";
import { RULE_LABELS } from "@/lib/alerts/labels";

export type AlertPanelRow = {
  id: string;
  ruleKey: string;
  severity: string;
  name: string;
  triggeredAt: string;
};

const SEVERITY_CLASS: Record<string, string> = {
  red: "bg-bad-tint text-bad",
  amber: "bg-warn-tint text-warn",
};

/** Section 9.1: "Top 3 alerts requiring attention, pinned at the top." */
export function AlertPanel({ alerts, limit = 3 }: { alerts: AlertPanelRow[]; limit?: number }) {
  const top = alerts.slice(0, limit);

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-bold">Alerts</p>
        <Link href="/dashboard/alerts" className="text-xs text-muted hover:text-accent">
          View all
        </Link>
      </div>
      {top.length === 0 ? (
        <p className="text-sm text-muted">No active alerts.</p>
      ) : (
        <ul className="space-y-2">
          {top.map((a) => (
            <li key={a.id} className="flex items-center gap-2 text-sm">
              <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold uppercase ${SEVERITY_CLASS[a.severity]}`}>
                {a.severity}
              </span>
              <span className="truncate">
                {RULE_LABELS[a.ruleKey] ?? a.ruleKey} — {a.name}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
