"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveWorkspaceId } from "@/lib/workspace";
import { getDashboardContext } from "@/lib/dashboard/context";

/** Admin-only threshold configuration (Section 9.10, 12). Gated in the
 * action itself, not just hidden in the UI — same posture as everything
 * else RLS/role-gates in this app. */
export async function updateProfitabilityThresholds(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const cookieStore = await cookies();
  const workspaceId = await resolveActiveWorkspaceId(supabase, cookieStore.get("active_workspace_id")?.value);
  if (!workspaceId) throw new Error("No workspace found");

  const { roleName } = await getDashboardContext(supabase, workspaceId, user.id);
  if (roleName !== "Administrator") throw new Error("Only Administrators can change profitability thresholds");

  const breakEvenMarginPct = Number(formData.get("breakEvenMarginPct"));
  const consecutiveDayThreshold = Number(formData.get("consecutiveDayThreshold"));
  const minSpendForEligibility = Number(formData.get("minSpendForEligibility"));

  const { error } = await supabase
    .from("workspace")
    .update({
      profitability_thresholds: { breakEvenMarginPct, consecutiveDayThreshold, minSpendForEligibility },
    })
    .eq("id", workspaceId);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/profitability");
}
