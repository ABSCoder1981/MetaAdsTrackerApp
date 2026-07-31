"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function acknowledgeAlert(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const alertId = String(formData.get("alert_id") ?? "");
  if (!alertId || !user) return;

  const { error } = await supabase
    .from("alert")
    .update({ status: "acknowledged", acknowledged_at: new Date().toISOString(), acknowledged_by: user.id })
    .eq("id", alertId);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/alerts");
}

export async function resolveAlert(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const alertId = String(formData.get("alert_id") ?? "");
  if (!alertId || !user) return;

  const { error } = await supabase
    .from("alert")
    .update({ status: "resolved", resolved_at: new Date().toISOString(), resolved_by: user.id })
    .eq("id", alertId);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/alerts");
}

export async function escalateAlert(formData: FormData) {
  const supabase = await createClient();
  const alertId = String(formData.get("alert_id") ?? "");
  if (!alertId) return;

  const { error } = await supabase.from("alert").update({ status: "escalated" }).eq("id", alertId);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/alerts");
}
