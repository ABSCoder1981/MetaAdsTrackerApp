"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function setActiveWorkspace(formData: FormData) {
  const workspaceId = String(formData.get("workspace_id") ?? "");
  if (!workspaceId) return;

  const cookieStore = await cookies();
  cookieStore.set("active_workspace_id", workspaceId, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });

  redirect("/dashboard");
}

/**
 * Self-service link between the signed-in user and a sales_team_employee
 * row (Section 11.3/11.5's "my accounts"/"my campaigns" scoping needs this
 * — RBAC role and org-chart identity are separate concepts, and nothing
 * else in the app currently creates this link). Guarded so a user can only
 * claim an employee row that's still unclaimed, not hijack someone else's.
 */
export async function linkMyEmployeeProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const employeeId = String(formData.get("employee_id") ?? "");
  if (!user || !employeeId) return;

  const { error } = await supabase
    .from("sales_team_employee")
    .update({ user_id: user.id })
    .eq("id", employeeId)
    .is("user_id", null);
  if (error) throw new Error(error.message);

  redirect("/dashboard");
}
