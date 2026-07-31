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

export async function createSalesTeamEmployee(formData: FormData) {
  const { supabase, workspaceId } = await getSessionAndWorkspace();
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "Manager").trim();
  if (!name) throw new Error("Name is required");

  const { error } = await supabase.from("sales_team_employee").insert({ workspace_id: workspaceId, name, role });
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/campaigns");
}

export async function bulkTagCampaigns(formData: FormData) {
  const { supabase, workspaceId } = await getSessionAndWorkspace();

  const campaignIds = formData.getAll("campaign_id").map(String);
  if (campaignIds.length === 0) throw new Error("No campaigns selected");

  const propertyId = String(formData.get("property_id") ?? "") || null;
  const managerId = String(formData.get("manager_id") ?? "") || null;
  const executiveId = String(formData.get("executive_id") ?? "") || null;

  const update: Record<string, string | null> = { tagging_source: "manual" };
  if (propertyId) update.property_id = propertyId;
  if (managerId) update.manager_id = managerId;
  if (executiveId) update.executive_id = executiveId;

  const { error } = await supabase
    .from("campaign")
    .update(update)
    .eq("workspace_id", workspaceId)
    .in("id", campaignIds);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/campaigns");
}

/**
 * Auto-tags untagged campaigns by parsing their name against the
 * recommended naming convention (PRD Section 5.1). Creates the
 * Property/Manager records on the fly if they don't already exist by name
 * — this is what "auto-parsed to populate property/city/manager tags"
 * means in practice, not just matching pre-existing rows.
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
  const { data: employees } = await supabase
    .from("sales_team_employee")
    .select("id, name")
    .eq("workspace_id", workspaceId);

  const propertyByName = new Map((properties ?? []).map((p) => [p.name.toLowerCase(), p.id]));
  const employeeByName = new Map((employees ?? []).map((e) => [e.name.toLowerCase(), e.id]));

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

    let managerId = employeeByName.get(parsed.managerName.toLowerCase());
    if (!managerId) {
      const { data: newEmp } = await supabase
        .from("sales_team_employee")
        .insert({ workspace_id: workspaceId, name: parsed.managerName, role: "Manager" })
        .select("id")
        .single();
      if (newEmp) {
        managerId = newEmp.id;
        employeeByName.set(parsed.managerName.toLowerCase(), newEmp.id);
      }
    }

    if (propertyId || managerId) {
      await supabase
        .from("campaign")
        .update({
          property_id: propertyId ?? null,
          manager_id: managerId ?? null,
          tagging_source: "naming_convention",
        })
        .eq("id", c.id);
    }
  }

  revalidatePath("/dashboard/campaigns");
}
