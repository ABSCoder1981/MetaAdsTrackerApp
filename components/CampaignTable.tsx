"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { bulkTagCampaigns } from "@/app/dashboard/campaigns/actions";
import { HEALTH_DOT_CLASS, HEALTH_LABEL, type HealthStatus } from "@/lib/campaigns/health";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { TableScroller } from "@/components/TableScroller";
import type { ExportColumn } from "@/lib/export/csv";

export type CampaignRow = {
  id: string;
  name: string;
  status: string | null;
  objective: string | null;
  adAccountName: string;
  city: string | null;
  spend: number;
  impressions: number;
  leads: number;
  cpl: number | null;
  /** Range-correct (clicks/impressions×100) — null until clicks data exists
   * for the selected range (historical rows synced before clicks tracking
   * was added won't have it). */
  ctr: number | null;
  /** Range-correct (spend/clicks) — same clicks-availability caveat as ctr. */
  cpc: number | null;
  /** Range-correct (spend/impressions×1000) — always computable, no clicks needed. */
  cpm: number | null;
  /** Meta's own value for the LATEST day in the selected range, not a
   * period average — reach isn't additive across days so a true range
   * frequency can't be derived from stored data. */
  latestFrequency: number | null;
  health: HealthStatus;
};

const EXPORT_COLUMNS: ExportColumn<CampaignRow>[] = [
  { key: "name", label: "Campaign" },
  { key: "adAccountName", label: "Account" },
  { key: "status", label: "Status" },
  { key: "spend", label: "Spend" },
  { key: "impressions", label: "Impressions" },
  { key: "leads", label: "Leads" },
  { key: "cpl", label: "CPL" },
  { key: "ctr", label: "CTR %" },
  { key: "cpc", label: "CPC" },
  { key: "cpm", label: "CPM" },
  { key: "latestFrequency", label: "Frequency (latest day)" },
  { key: "city", label: "City" },
];

export function CampaignTable({ rows }: { rows: CampaignRow[] }) {
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
      <div className="mb-3 flex justify-end">
        <ExportCsvButton rows={rows} columns={EXPORT_COLUMNS} filename="campaigns.csv" />
      </div>
      {selected.size > 0 && (
        <form
          action={handleTagSubmit}
          className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-raised p-3 text-sm"
        >
          {[...selected].map((id) => (
            <input key={id} type="hidden" name="campaign_id" value={id} />
          ))}
          <span className="font-medium">{selected.size} selected</span>
          <input
            name="city"
            placeholder="City…"
            className="rounded-md border border-border bg-background px-2 py-1 text-foreground"
          />
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-foreground px-3 py-1 text-background disabled:opacity-50"
          >
            {isPending ? "Applying…" : "Apply tags"}
          </button>
        </form>
      )}

      <TableScroller>
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="text-[10px] uppercase tracking-wide text-faint">
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
              <th className="px-3 py-2 text-right">CTR</th>
              <th className="px-3 py-2 text-right">CPC</th>
              <th className="px-3 py-2 text-right">CPM</th>
              <th className="px-3 py-2 text-right" title="Latest day in range, not a period average">
                Freq.
              </th>
              <th className="px-3 py-2">City</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
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
                <td className="px-3 py-2 text-muted">{r.adAccountName}</td>
                <td className="px-3 py-2 text-muted">{r.status ?? "—"}</td>
                <td className="tabular-nums px-3 py-2 text-right">{r.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                <td className="tabular-nums px-3 py-2 text-right">{r.impressions.toLocaleString()}</td>
                <td className="tabular-nums px-3 py-2 text-right">{r.leads}</td>
                <td className="tabular-nums px-3 py-2 text-right">{r.cpl ? r.cpl.toFixed(0) : "—"}</td>
                <td className="tabular-nums px-3 py-2 text-right">{r.ctr != null ? `${r.ctr.toFixed(2)}%` : "—"}</td>
                <td className="tabular-nums px-3 py-2 text-right">{r.cpc != null ? r.cpc.toFixed(2) : "—"}</td>
                <td className="tabular-nums px-3 py-2 text-right">{r.cpm != null ? r.cpm.toFixed(0) : "—"}</td>
                <td className="tabular-nums px-3 py-2 text-right">{r.latestFrequency != null ? r.latestFrequency.toFixed(2) : "—"}</td>
                <td className="px-3 py-2 text-muted">{r.city ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroller>
    </div>
  );
}
