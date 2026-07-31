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

export async function createProperty(formData: FormData) {
  const { supabase, workspaceId } = await getSessionAndWorkspace();
  const name = String(formData.get("name") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim() || null;
  if (!name) throw new Error("Property name is required");

  const { error } = await supabase.from("property").insert({ workspace_id: workspaceId, name, city });
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/campaigns");
}

/**
 * Manual, in-app tagging only — PRD v4 Section 5.1 explicitly states the
 * system "will not attempt to auto-parse campaign names to extract
 * property, city, or any other attribute." Property and City are tagged
 * independently (Section 9.2), not derived from one another.
 */
export async function bulkTagCampaigns(formData: FormData) {
  const { supabase, workspaceId } = await getSessionAndWorkspace();

  const campaignIds = formData.getAll("campaign_id").map(String);
  if (campaignIds.length === 0) throw new Error("No campaigns selected");

  const propertyId = String(formData.get("property_id") ?? "") || null;
  const city = String(formData.get("city") ?? "").trim() || null;
  if (!propertyId && !city) throw new Error("Select a property or enter a city to apply");

  const update: Record<string, string> = { tagging_source: "manual" };
  if (propertyId) update.property_id = propertyId;
  if (city) update.city = city;

  const { error } = await supabase
    .from("campaign")
    .update(update)
    .eq("workspace_id", workspaceId)
    .in("id", campaignIds);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/campaigns");
}
