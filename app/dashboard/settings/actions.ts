"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveActiveWorkspaceId } from "@/lib/workspace";
import { getDashboardContext } from "@/lib/dashboard/context";
import { logAuditEvent } from "@/lib/settings/audit";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const cookieStore = await cookies();
  const workspaceId = await resolveActiveWorkspaceId(supabase, cookieStore.get("active_workspace_id")?.value);
  if (!workspaceId) throw new Error("No workspace found");

  const { roleName } = await getDashboardContext(supabase, workspaceId, user.id);
  if (roleName !== "Administrator") throw new Error("Only Administrators can manage workspace settings");

  return { supabase, user, workspaceId };
}

export async function updateWorkspaceSettings(formData: FormData) {
  const { user, workspaceId } = await requireAdmin();
  const admin = createAdminClient();

  const name = String(formData.get("name") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "").trim();
  const currency = String(formData.get("currency") ?? "").trim();
  if (!name || !timezone || !currency) throw new Error("Name, timezone, and currency are all required");

  const { error } = await admin.from("workspace").update({ name, timezone, currency }).eq("id", workspaceId);
  if (error) throw new Error(error.message);

  await logAuditEvent({ workspaceId, userId: user.id, action: "workspace_settings_updated", details: { name, timezone, currency } });
  revalidatePath("/dashboard/settings");
}

export async function addMemberByEmail(formData: FormData) {
  const { user, workspaceId } = await requireAdmin();
  const admin = createAdminClient();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const roleId = String(formData.get("role_id") ?? "");
  if (!email || !roleId) throw new Error("Email and role are required");

  const { data: usersPage, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 500 });
  if (listErr) throw new Error(listErr.message);
  const match = usersPage.users.find((u) => u.email?.toLowerCase() === email);
  if (!match) throw new Error(`No account found for ${email} — ask them to sign up first, then add them here.`);

  const { data: existing } = await admin
    .from("workspace_member")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", match.id)
    .maybeSingle();
  if (existing) throw new Error(`${email} is already a member of this workspace`);

  const { error: insertErr } = await admin
    .from("workspace_member")
    .insert({ workspace_id: workspaceId, user_id: match.id, role_id: roleId });
  if (insertErr) throw new Error(insertErr.message);

  await logAuditEvent({ workspaceId, userId: user.id, action: "member_added", details: { email, roleId } });
  revalidatePath("/dashboard/settings");
}

export async function changeMemberRole(formData: FormData) {
  const { user, workspaceId } = await requireAdmin();
  const admin = createAdminClient();

  const targetUserId = String(formData.get("user_id") ?? "");
  const roleId = String(formData.get("role_id") ?? "");
  if (!targetUserId || !roleId) throw new Error("Missing member or role");

  await assertNotLastAdmin(admin, workspaceId, targetUserId, roleId);

  const { error } = await admin
    .from("workspace_member")
    .update({ role_id: roleId })
    .eq("workspace_id", workspaceId)
    .eq("user_id", targetUserId);
  if (error) throw new Error(error.message);

  await logAuditEvent({ workspaceId, userId: user.id, action: "member_role_changed", details: { targetUserId, roleId } });
  revalidatePath("/dashboard/settings");
}

export async function removeMember(formData: FormData) {
  const { user, workspaceId } = await requireAdmin();
  const admin = createAdminClient();

  const targetUserId = String(formData.get("user_id") ?? "");
  if (!targetUserId) throw new Error("Missing member");

  await assertNotLastAdmin(admin, workspaceId, targetUserId, null);

  const { error } = await admin
    .from("workspace_member")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", targetUserId);
  if (error) throw new Error(error.message);

  await logAuditEvent({ workspaceId, userId: user.id, action: "member_removed", details: { targetUserId } });
  revalidatePath("/dashboard/settings");
}

/**
 * Blocks role changes/removals that would leave a workspace with zero
 * Administrators — a workspace nobody can administer is unrecoverable
 * without a support ticket, so this is checked server-side, not just
 * discouraged in the UI.
 */
async function assertNotLastAdmin(
  admin: ReturnType<typeof createAdminClient>,
  workspaceId: string,
  targetUserId: string,
  newRoleId: string | null
) {
  const { data: adminRole } = await admin.from("role").select("id").is("workspace_id", null).eq("name", "Administrator").single();
  if (!adminRole) return;

  const { data: target } = await admin
    .from("workspace_member")
    .select("role_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", targetUserId)
    .single();
  const targetIsCurrentlyAdmin = target?.role_id === adminRole.id;
  const targetStaysAdmin = newRoleId === adminRole.id;
  if (!targetIsCurrentlyAdmin || targetStaysAdmin) return;

  const { count } = await admin
    .from("workspace_member")
    .select("user_id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("role_id", adminRole.id);
  if ((count ?? 0) <= 1) {
    throw new Error("Cannot remove the last Administrator — assign another member as Administrator first.");
  }
}
