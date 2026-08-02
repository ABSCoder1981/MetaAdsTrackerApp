import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveActiveWorkspaceId } from "@/lib/workspace";
import { getDashboardContext } from "@/lib/dashboard/context";
import { TableScroller } from "@/components/TableScroller";

const ACTION_LABEL: Record<string, string> = {
  workspace_created: "Workspace created",
  workspace_settings_updated: "Workspace settings updated",
  member_added: "Member added",
  member_role_changed: "Member role changed",
  member_removed: "Member removed",
  property_deleted: "Property deleted",
  profitability_thresholds_updated: "Profitability thresholds updated",
};

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const cookieStore = await cookies();
  const workspaceId = await resolveActiveWorkspaceId(supabase, cookieStore.get("active_workspace_id")?.value);
  if (!workspaceId || !user) return null;

  const context = await getDashboardContext(supabase, workspaceId, user.id);
  if (context.roleName !== "Administrator") {
    return (
      <div className="max-w-2xl">
        <h1 className="mb-2 text-2xl font-bold">Audit Log</h1>
        <p className="rounded-lg border border-border bg-surface p-4 text-sm text-muted">
          Only Administrators can view the audit log.
        </p>
      </div>
    );
  }

  const admin = createAdminClient();
  let query = admin
    .from("audit_log")
    .select("id, user_id, action, details, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (params.action) query = query.eq("action", params.action);

  const [{ data: rows }, { data: usersPage }] = await Promise.all([query, admin.auth.admin.listUsers({ page: 1, perPage: 500 })]);
  const emailByUserId = new Map((usersPage?.users ?? []).map((u) => [u.id, u.email ?? "—"]));

  const actionOptions = Object.keys(ACTION_LABEL);

  return (
    <div className="max-w-4xl">
      <h1 className="mb-4 text-2xl font-bold">Audit Log</h1>

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <a
          href="/dashboard/audit-log"
          className={`rounded-full border px-3 py-1 ${!params.action ? "border-foreground bg-foreground text-background" : "border-border text-muted"}`}
        >
          All
        </a>
        {actionOptions.map((a) => (
          <a
            key={a}
            href={`/dashboard/audit-log?action=${a}`}
            className={`rounded-full border px-3 py-1 ${params.action === a ? "border-foreground bg-foreground text-background" : "border-border text-muted"}`}
          >
            {ACTION_LABEL[a]}
          </a>
        ))}
      </div>

      <TableScroller>
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-[10px] uppercase tracking-wide text-faint">
            <tr>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Who</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Details</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="tabular-nums px-3 py-2 text-xs text-muted">{new Date(r.created_at).toLocaleString()}</td>
                <td className="px-3 py-2">{r.user_id ? (emailByUserId.get(r.user_id) ?? "—") : "System"}</td>
                <td className="px-3 py-2">{ACTION_LABEL[r.action] ?? r.action}</td>
                <td className="max-w-[280px] truncate px-3 py-2 text-xs text-muted" title={JSON.stringify(r.details)}>
                  {JSON.stringify(r.details)}
                </td>
              </tr>
            ))}
            {(rows ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-muted">
                  No audit events recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableScroller>
    </div>
  );
}
