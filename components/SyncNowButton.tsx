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
        className="rounded-md border border-border px-3 py-1 text-sm disabled:opacity-50"
      >
        {isPending ? "Syncing…" : "Sync now"}
      </button>
      {result && <p className="text-xs text-muted">{result}</p>}
    </div>
  );
}
