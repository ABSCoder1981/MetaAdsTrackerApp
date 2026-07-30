"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function SyncNowButton({ adAccountId }: { adAccountId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  function handleClick() {
    setResult(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/sync/${adAccountId}`, { method: "POST" });
        const body = await res.json();
        setResult(
          body.status === "success"
            ? `Synced ${body.campaignsSynced} campaigns, ${body.metricsRowsSynced} metric rows.`
            : `Error: ${body.error ?? "unknown"}`
        );
        router.refresh();
      } catch {
        setResult("Network error triggering sync.");
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={handleClick}
        disabled={isPending}
        className="rounded border border-zinc-300 px-3 py-1 text-sm disabled:opacity-50 dark:border-zinc-700"
      >
        {isPending ? "Syncing…" : "Sync now"}
      </button>
      {result && <p className="text-xs text-zinc-600 dark:text-zinc-400">{result}</p>}
    </div>
  );
}
