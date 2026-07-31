"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateLeadQualityTag(formData: FormData) {
  const supabase = await createClient();
  const leadId = String(formData.get("lead_id") ?? "");
  const qualityTag = String(formData.get("quality_tag") ?? "") || null;
  if (!leadId) throw new Error("Missing lead");

  const { error } = await supabase.from("lead").update({ quality_tag: qualityTag }).eq("id", leadId);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/leads");
}
