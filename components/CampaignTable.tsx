"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { bulkTagCampaigns } from "@/app/dashboard/campaigns/actions";
import { HEALTH_DOT_CLASS, HEALTH_LABEL, type HealthStatus } from "@/lib/campaigns/health";

export type CampaignRow = {
  id: string;
  name: string;
  status: string | null;
  objective: string | null;
  adAccountName: string;
  propertyName: string | null;
  spend: number;
  impressions: number;
  leads: number;
  cpl: number | null;
  health: HealthStatus;
};

type Option = { id: string; name: string };

export function CampaignTable({ rows, properties }: { rows: CampaignRow[]; properties: Option[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))));
  }

  function handleTagSubmit(formData: FormData) {
    startTransition(async () => {
      await bulkTagCampaigns(formData);
      setSelected(new Set());
    });
  }

  return (
    <div>
      {selected.size > 0 && (
        <form
          action={handleTagSubmit}
          className="mb-3 flex flex-wrap items-center gap-2 rounded border border-zinc-300 bg-zinc-50 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          {[...selected].map((id) => (
            <input key={id} type="hidden" name="campaign_id" value={id} />
          ))}
          <span className="font-medium">{selected.size} selected</span>
          <select name="property_id" className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900" defaultValue="">
            <option value="">Property…</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={isPending}
            className="rounded bg-black px-3 py-1 text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {isPending ? "Applying…" : "Apply tags"}
          </button>
        </form>
      )}

      <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2">
                <input
                  type="checkbox"
                  checked={rows.length > 0 && selected.size === rows.length}
                  onChange={toggleAll}
                  aria-label="Select all"
                />
              </th>
              <th className="px-3 py-2">Health</th>
              <th className="px-3 py-2">Campaign</th>
              <th className="px-3 py-2">Account</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Spend</th>
              <th className="px-3 py-2 text-right">Impressions</th>
              <th className="px-3 py-2 text-right">Leads</th>
              <th className="px-3 py-2 text-right">CPL</th>
              <th className="px-3 py-2">Property</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="px-3 py-2">
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-block h-2.5 w-2.5 rounded-full ${HEALTH_DOT_CLASS[r.health]}`}
                    title={HEALTH_LABEL[r.health]}
                  />
                </td>
                <td className="max-w-[220px] truncate px-3 py-2 font-medium">
                  <Link href={`/dashboard/campaigns/${r.id}`} className="hover:underline">
                    {r.name}
                  </Link>
                </td>
                <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{r.adAccountName}</td>
                <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{r.status ?? "—"}</td>
                <td className="px-3 py-2 text-right">{r.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                <td className="px-3 py-2 text-right">{r.impressions.toLocaleString()}</td>
                <td className="px-3 py-2 text-right">{r.leads}</td>
                <td className="px-3 py-2 text-right">{r.cpl ? r.cpl.toFixed(0) : "—"}</td>
                <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{r.propertyName ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
