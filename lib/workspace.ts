import { SupabaseClient } from "@supabase/supabase-js";

export type WorkspaceMembership = {
  workspace_id: string;
  workspace_name: string;
  role_name: string;
};

/**
 * Workspaces the signed-in user belongs to, joined with their role name
 * (Section 9.16 workspace switcher / Section 21 RBAC).
 */
export async function getUserWorkspaces(
  supabase: SupabaseClient
): Promise<WorkspaceMembership[]> {
  const { data, error } = await supabase
    .from("workspace_member")
    .select("workspace_id, workspace(name), role(name)");

  if (error || !data) return [];

  return data.map((row: unknown) => {
    const r = row as {
      workspace_id: string;
      workspace: { name: string } | { name: string }[];
      role: { name: string } | { name: string }[];
    };
    const workspace = Array.isArray(r.workspace) ? r.workspace[0] : r.workspace;
    const role = Array.isArray(r.role) ? r.role[0] : r.role;
    return {
      workspace_id: r.workspace_id,
      workspace_name: workspace?.name ?? "Unnamed workspace",
      role_name: role?.name ?? "Member",
    };
  });
}

/**
 * Resolves which workspace should be "active" for the current request: the
 * cookie value if it's one the user actually belongs to, otherwise their
 * first workspace. Centralized so every page/action that needs "the current
 * workspace" agrees on the fallback — the dashboard layout does this
 * implicitly on render, but that never persists a cookie, so anything that
 * *requires* a cookie (like a server action) needs this same fallback
 * rather than assuming the cookie is always set.
 */
export async function resolveActiveWorkspaceId(
  supabase: SupabaseClient,
  cookieWorkspaceId: string | undefined
): Promise<string | null> {
  const workspaces = await getUserWorkspaces(supabase);
  if (workspaces.length === 0) return null;

  const matched = workspaces.find((w) => w.workspace_id === cookieWorkspaceId);
  return matched ? matched.workspace_id : workspaces[0].workspace_id;
}
