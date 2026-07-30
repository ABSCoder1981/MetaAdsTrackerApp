"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Connects a Business Manager + Ad Account to the current workspace,
 * storing the System User token in Supabase Vault (never in a plain
 * column — see supabase/migrations/0002_meta_sync_infrastructure.sql).
 *
 * Runs as a server action so it can use the admin (service_role) client to
 * call the vault-backed store_meta_token RPC, which is deliberately not
 * callable from an authenticated user's browser session.
 */
export async function connectAdAccount(formData: FormData) {
  const cookieStore = await cookies();
  const workspaceId = cookieStore.get("active_workspace_id")?.value;
  if (!workspaceId) {
    throw new Error("No active workspace selected");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not signed in");
  }

  // Confirm the caller actually belongs to this workspace (RLS would block
  // the admin-client writes below from catching this, since admin bypasses
  // RLS by design — this check is what stands in for it).
  const { data: membership } = await supabase
    .from("workspace_member")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .single();
  if (!membership) {
    throw new Error("Not a member of this workspace");
  }

  const metaBmId = String(formData.get("meta_bm_id") ?? "").trim();
  const metaAdAccountId = String(formData.get("meta_ad_account_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const currency = String(formData.get("currency") ?? "USD").trim();
  const systemUserToken = String(formData.get("system_user_token") ?? "").trim();

  if (!metaBmId || !metaAdAccountId || !name || !systemUserToken) {
    throw new Error("All fields are required");
  }

  const admin = createAdminClient();

  const { data: secretId, error: secretErr } = await admin.rpc("store_meta_token", {
    secret_value: systemUserToken,
    secret_name: `meta-token-${workspaceId}-${metaBmId}`,
  });
  if (secretErr) {
    throw new Error(`Failed to store token: ${secretErr.message}`);
  }

  const { data: bm, error: bmErr } = await admin
    .from("business_manager")
    .upsert(
      { workspace_id: workspaceId, meta_bm_id: metaBmId, system_user_token_secret_ref: secretId },
      { onConflict: "workspace_id,meta_bm_id" }
    )
    .select("id")
    .single();
  if (bmErr || !bm) {
    throw new Error(`Failed to save Business Manager: ${bmErr?.message}`);
  }

  const { error: adAccErr } = await admin.from("ad_account").upsert(
    {
      workspace_id: workspaceId,
      business_manager_id: bm.id,
      meta_ad_account_id: metaAdAccountId,
      name,
      currency,
    },
    { onConflict: "workspace_id,meta_ad_account_id" }
  );
  if (adAccErr) {
    throw new Error(`Failed to save Ad Account: ${adAccErr.message}`);
  }

  redirect("/dashboard/ad-accounts");
}
