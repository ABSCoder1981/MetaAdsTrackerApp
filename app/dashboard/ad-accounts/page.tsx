import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { SyncNowButton } from "@/components/SyncNowButton";
import { connectAdAccount } from "./actions";

export default async function AdAccountsPage() {
  const cookieStore = await cookies();
  const workspaceId = cookieStore.get("active_workspace_id")?.value;
  const supabase = await createClient();

  const { data: adAccounts } = await supabase
    .from("ad_account")
    .select("id, name, meta_ad_account_id, currency, last_synced_at, last_sync_status, last_sync_error")
    .eq("workspace_id", workspaceId ?? "");

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-2xl font-semibold text-black dark:text-zinc-50">Ad Accounts</h1>

      <div className="mb-8 space-y-3">
        {(adAccounts ?? []).length === 0 && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No ad accounts connected yet.</p>
        )}
        {(adAccounts ?? []).map((a) => (
          <div
            key={a.id}
            className="rounded border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="font-medium text-black dark:text-zinc-50">{a.name}</p>
                <p className="text-xs text-zinc-500">
                  {a.meta_ad_account_id} · {a.currency}
                </p>
              </div>
              <SyncNowButton adAccountId={a.id} />
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Last synced: {a.last_synced_at ? new Date(a.last_synced_at).toLocaleString() : "never"} — status:{" "}
              <span
                className={
                  a.last_sync_status === "success"
                    ? "text-emerald-600"
                    : a.last_sync_status === "error"
                      ? "text-red-600"
                      : "text-zinc-500"
                }
              >
                {a.last_sync_status}
              </span>
            </p>
            {a.last_sync_error && <p className="text-xs text-red-600">{a.last_sync_error}</p>}
          </div>
        ))}
      </div>

      <h2 className="mb-2 text-lg font-semibold text-black dark:text-zinc-50">Connect an Ad Account</h2>
      <form action={connectAdAccount} className="space-y-3 rounded border border-zinc-200 p-4 dark:border-zinc-800">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Business Manager ID
          </label>
          <input
            name="meta_bm_id"
            required
            className="w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Ad Account ID (act_XXXXXXXXXX)
          </label>
          <input
            name="meta_ad_account_id"
            required
            placeholder="act_1234567890"
            className="w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Display name</label>
          <input
            name="name"
            required
            className="w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Currency</label>
          <input
            name="currency"
            defaultValue="USD"
            required
            className="w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            System User access token
          </label>
          <input
            name="system_user_token"
            type="password"
            required
            className="w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <p className="mt-1 text-xs text-zinc-500">
            Stored encrypted via Supabase Vault — never written to a plain column.
          </p>
        </div>
        <button
          type="submit"
          className="rounded bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          Connect
        </button>
      </form>
    </div>
  );
}
