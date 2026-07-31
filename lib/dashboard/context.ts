import type { SupabaseClient } from "@supabase/supabase-js";

export type DashboardContext = {
  roleName: string;
  /** The sales_team_employee row linked to this user, if any (Section
   * 9.10's "my team"/"my campaigns" scoping needs this — a user's RBAC
   * role and their org-chart identity are separate concepts; see
   * lib/dashboard/context.ts and the self-service linking on the
   * dashboard for Manager/Supervisor/Executive roles that aren't linked
   * yet). */
  employeeId: string | null;
};

export async function getDashboardContext(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string
): Promise<DashboardContext> {
  const { data: membership } = await supabase
    .from("workspace_member")
    .select("role(name)")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .single();

  const role = Array.isArray(membership?.role) ? membership.role[0] : membership?.role;
  const roleName = (role as { name?: string } | null)?.name ?? "Administrator";

  const { data: employee } = await supabase
    .from("sales_team_employee")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  return { roleName, employeeId: employee?.id ?? null };
}
