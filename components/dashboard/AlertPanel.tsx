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
  red: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
};

/** Section 9.1: "Top 3 alerts requiring attention, pinned at the top." */
export function AlertPanel({ alerts, limit = 3 }: { alerts: AlertPanelRow[]; limit?: number }) {
  const top = alerts.slice(0, limit);

  return (
    <div className="rounded border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-black dark:text-zinc-50">Alerts</p>
        <Link href="/dashboard/alerts" className="text-xs text-zinc-500 underline">
          View all
        </Link>
      </div>
      {top.length === 0 ? (
        <p className="text-sm text-zinc-500">No active alerts.</p>
      ) : (
        <ul className="space-y-2">
          {top.map((a) => (
            <li key={a.id} className="flex items-center gap-2 text-sm">
              <span className={`rounded px-1.5 py-0.5 text-xs font-medium uppercase ${SEVERITY_CLASS[a.severity]}`}>
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
