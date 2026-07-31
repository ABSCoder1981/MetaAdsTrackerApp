"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveWorkspaceId } from "@/lib/workspace";
import { parseCampaignName } from "@/lib/campaigns/naming";

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

export async function bulkTagCampaigns(formData: FormData) {
  const { supabase, workspaceId } = await getSessionAndWorkspace();

  const campaignIds = formData.getAll("campaign_id").map(String);
  if (campaignIds.length === 0) throw new Error("No campaigns selected");

  const propertyId = String(formData.get("property_id") ?? "") || null;
  if (!propertyId) throw new Error("Select a property to apply");

  const { error } = await supabase
    .from("campaign")
    .update({ property_id: propertyId, tagging_source: "manual" })
    .eq("workspace_id", workspaceId)
    .in("id", campaignIds);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/campaigns");
}

/**
 * Auto-tags untagged campaigns by parsing their name against the
 * recommended naming convention (PRD Section 5.1). Creates the Property
 * record on the fly if it doesn't already exist by name. Manager/Executive
 * tagging was removed from the app (deliberate deviation from PRD Sections
 * 7.3-7.5/9.10/11.3-11.5/21 — see docs/DEVELOPMENT_PLAN.md's deviation log)
 * — the parser still identifies a manager-like name prefix structurally
 * (that's how it locates where the property name starts), it's just no
 * longer saved anywhere.
 */
export async function autoTagFromNaming(): Promise<void> {
  const { supabase, workspaceId } = await getSessionAndWorkspace();

  const { data: campaigns, error } = await supabase
    .from("campaign")
    .select("id, name")
    .eq("workspace_id", workspaceId)
    .is("property_id", null);
  if (error) throw new Error(error.message);

  const { data: properties } = await supabase.from("property").select("id, name").eq("workspace_id", workspaceId);
  const propertyByName = new Map((properties ?? []).map((p) => [p.name.toLowerCase(), p.id]));

  for (const c of campaigns ?? []) {
    const parsed = parseCampaignName(c.name);
    if (!parsed) continue;

    let propertyId = propertyByName.get(parsed.propertyName.toLowerCase());
    if (!propertyId) {
      const { data: newProp } = await supabase
        .from("property")
        .insert({ workspace_id: workspaceId, name: parsed.propertyName })
        .select("id")
        .single();
      if (newProp) {
        propertyId = newProp.id;
        propertyByName.set(parsed.propertyName.toLowerCase(), newProp.id);
      }
    }

    if (propertyId) {
      await supabase
        .from("campaign")
        .update({ property_id: propertyId, tagging_source: "naming_convention" })
        .eq("id", c.id);
    }
  }

  revalidatePath("/dashboard/campaigns");
}
