"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
