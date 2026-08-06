"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveWorkspaceId } from "@/lib/workspace";

async function getSessionAndWorkspace() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const cookieStore = await cookies();
  const workspaceId = await resolveActiveWorkspaceId(supabase, cookieStore.get("active_workspace_id")?.value);
  if (!workspaceId) throw new Error("No workspace found for this user");

  return { supabase, user, workspaceId };
}

/**
 * Manual, in-app tagging only — PRD v4 Section 5.1 explicitly states the
 * system "will not attempt to auto-parse campaign names to extract
 * property, city, or any other attribute." City is an independent
 * campaign-level tag (Section 9.2).
 */
export async function bulkTagCampaigns(formData: FormData) {
  const { supabase, workspaceId } = await getSessionAndWorkspace();

  const campaignIds = formData.getAll("campaign_id").map(String);
  if (campaignIds.length === 0) throw new Error("No campaigns selected");

  const city = String(formData.get("city") ?? "").trim() || null;
  if (!city) throw new Error("Enter a city to apply");

  const { error } = await supabase
    .from("campaign")
    .update({ city })
    .eq("workspace_id", workspaceId)
    .in("id", campaignIds);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/campaigns");
}
