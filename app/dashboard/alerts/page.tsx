import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { RULE_LABELS } from "@/lib/alerts/labels";
import { acknowledgeAlert, resolveAlert, escalateAlert } from "./actions";

const SEVERITY_CLASS: Record<string, string> = {
  red: "bg-bad-tint text-bad",
  amber: "bg-warn-tint text-warn",
};

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const statusFilter = params.status ?? "active";

  let query = supabase
    .from("alert")
    .select("id, rule_key, severity, status, triggered_at, campaign(name), ad_account(name)")
    .order("triggered_at", { ascending: false })
    .limit(100);

  query = statusFilter === "active" ? query.in("status", ["open", "acknowledged"]) : query.eq("status", statusFilter);

  const { data: alerts } = await query;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Alerts</h1>
        <div className="flex gap-2 text-sm">
          {[
            { key: "active", label: "Active" },
            { key: "resolved", label: "Resolved" },
            { key: "escalated", label: "Escalated" },
          ].map((s) => (
            <Link
              key={s.key}
              href={`/dashboard/alerts?status=${s.key}`}
              className={`rounded-full border px-3 py-1 ${
                statusFilter === s.key
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted"
              }`}
            >
              {s.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {(alerts ?? []).map((a: Record<string, unknown>) => {
          const campaign = Array.isArray(a.campaign) ? a.campaign[0] : a.campaign;
          const adAccount = Array.isArray(a.ad_account) ? a.ad_account[0] : a.ad_account;
          return (
            <div
              key={a.id as string}
              className="flex items-center justify-between rounded-lg border border-border bg-surface p-3 text-sm"
            >
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[11px] font-bold uppercase ${SEVERITY_CLASS[a.severity as string]}`}
                  >
                    {a.severity as string}
                  </span>
                  <span className="font-medium">{RULE_LABELS[a.rule_key as string] ?? (a.rule_key as string)}</span>
                </div>
                <p className="text-muted">
                  {(campaign as { name?: string } | null)?.name ?? (adAccount as { name?: string } | null)?.name ?? "—"}
                  {" · "}
                  {new Date(a.triggered_at as string).toLocaleString()}
                  {" · "}
                  <span className="capitalize">{a.status as string}</span>
                </p>
              </div>
              <div className="flex gap-2">
                {a.status === "open" && (
                  <form action={acknowledgeAlert}>
                    <input type="hidden" name="alert_id" value={a.id as string} />
                    <button type="submit" className="rounded-md border border-border px-2 py-1 text-xs">
                      Acknowledge
                    </button>
                  </form>
                )}
                {(a.status === "open" || a.status === "acknowledged") && (
                  <>
                    <form action={resolveAlert}>
                      <input type="hidden" name="alert_id" value={a.id as string} />
                      <button type="submit" className="rounded-md border border-border px-2 py-1 text-xs">
                        Resolve
                      </button>
                    </form>
                    <form action={escalateAlert}>
                      <input type="hidden" name="alert_id" value={a.id as string} />
                      <button type="submit" className="rounded-md border border-border px-2 py-1 text-xs">
                        Escalate
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {(alerts ?? []).length === 0 && <p className="text-sm text-muted">No alerts in this view.</p>}
      </div>
    </div>
  );
}
