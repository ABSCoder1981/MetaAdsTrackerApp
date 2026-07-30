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
