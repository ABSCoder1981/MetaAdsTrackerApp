import type { SupabaseClient } from "@supabase/supabase-js";

export type DashboardContext = {
  roleName: string;
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

  return { roleName };
}
