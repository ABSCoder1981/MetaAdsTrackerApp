import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveWorkspaceId } from "@/lib/workspace";
import { SyncNowButton } from "@/components/SyncNowButton";
import { connectAdAccount } from "./actions";

export default async function AdAccountsPage() {
  const supabase = await createClient();
  const cookieStore = await cookies();
  const workspaceId = await resolveActiveWorkspaceId(supabase, cookieStore.get("active_workspace_id")?.value);

  const { data: adAccounts } = await supabase
    .from("ad_account")
    .select("id, name, meta_ad_account_id, currency, last_synced_at, last_sync_status, last_sync_error")
    .eq("workspace_id", workspaceId ?? "");

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-2xl font-bold">Ad Accounts</h1>

      <div className="mb-8 space-y-3">
        {(adAccounts ?? []).length === 0 && (
          <p className="text-sm text-muted">No ad accounts connected yet.</p>
        )}
        {(adAccounts ?? []).map((a) => (
          <div
            key={a.id}
            className="rounded-lg border border-border bg-surface p-4"
          >
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="font-medium">{a.name}</p>
                <p className="text-xs text-faint">
                  {a.meta_ad_account_id} · {a.currency}
                </p>
              </div>
              <SyncNowButton adAccountId={a.id} />
            </div>
            <p className="text-xs text-muted">
              Last synced: {a.last_synced_at ? new Date(a.last_synced_at).toLocaleString() : "never"} — status:{" "}
              <span
                className={
                  a.last_sync_status === "success"
                    ? "text-good"
                    : a.last_sync_status === "error"
                      ? "text-bad"
                      : "text-faint"
                }
              >
                {a.last_sync_status}
              </span>
            </p>
            {a.last_sync_error && <p className="text-xs text-bad">{a.last_sync_error}</p>}
          </div>
        ))}
      </div>

      <h2 className="mb-2 text-lg font-bold">Connect an Ad Account</h2>
      <form action={connectAdAccount} className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">
            Business Manager ID
          </label>
          <input
            name="meta_bm_id"
            required
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">
            Ad Account ID (act_XXXXXXXXXX)
          </label>
          <input
            name="meta_ad_account_id"
            required
            placeholder="act_1234567890"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">Display name</label>
          <input
            name="name"
            required
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">Currency</label>
          <input
            name="currency"
            defaultValue="USD"
            required
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">
            System User access token
          </label>
          <input
            name="system_user_token"
            type="password"
            required
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
          <p className="mt-1 text-xs text-faint">
            Stored encrypted via Supabase Vault — never written to a plain column.
          </p>
        </div>
        <button
          type="submit"
          className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background"
        >
          Connect
        </button>
      </form>
    </div>
  );
}
