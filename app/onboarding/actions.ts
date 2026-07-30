"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createWorkspace(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    throw new Error("Workspace name is required");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_workspace_with_owner", { workspace_name: name });

  if (error) {
    throw new Error(error.message);
  }

  redirect("/dashboard");
}
