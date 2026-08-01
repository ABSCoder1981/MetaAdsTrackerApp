"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveWorkspaceId } from "@/lib/workspace";
import { logAuditEvent } from "@/lib/settings/audit";

export async function updatePropertyAssumptions(formData: FormData) {
  const supabase = await createClient();
  const propertyId = String(formData.get("property_id") ?? "");
  const conversionRate = formData.get("assumed_conversion_rate");
  const avgDealValue = formData.get("assumed_avg_deal_value");

  if (!propertyId) throw new Error("Missing property");

  const { error } = await supabase
    .from("property")
    .update({
      assumed_conversion_rate: conversionRate ? Number(conversionRate) : null,
      assumed_avg_deal_value: avgDealValue ? Number(avgDealValue) : null,
    })
    .eq("id", propertyId);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/properties");
}

export async function deleteProperty(formData: FormData) {
  const supabase = await createClient();
  const propertyId = String(formData.get("property_id") ?? "");
  if (!propertyId) throw new Error("Missing property");

  // Refuse rather than cascade — `campaign.property_id` has no ON DELETE
  // clause (defaults to RESTRICT), and even if it did, silently untagging
  // campaigns as a side effect of "delete property" would be surprising.
  const { count, error: countErr } = await supabase
    .from("campaign")
    .select("id", { count: "exact", head: true })
    .eq("property_id", propertyId);
  if (countErr) throw new Error(countErr.message);
  if (count && count > 0) {
    throw new Error(
      `Cannot delete — ${count} campaign(s) are still tagged to this property. Untag them from the Campaigns page first.`
    );
  }

  const { data: property } = await supabase.from("property").select("name, workspace_id").eq("id", propertyId).single();

  const { error } = await supabase.from("property").delete().eq("id", propertyId);
  if (error) throw new Error(error.message);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const cookieStore = await cookies();
  const workspaceId = property?.workspace_id ?? (await resolveActiveWorkspaceId(supabase, cookieStore.get("active_workspace_id")?.value));
  if (user && workspaceId) {
    await logAuditEvent({ workspaceId, userId: user.id, action: "property_deleted", details: { propertyId, name: property?.name } });
  }

  revalidatePath("/dashboard/properties");
  revalidatePath("/dashboard/campaigns");
}
