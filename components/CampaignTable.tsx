"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { bulkTagCampaigns } from "@/app/dashboard/campaigns/actions";
import { HEALTH_DOT_CLASS, HEALTH_LABEL, type HealthStatus } from "@/lib/campaigns/health";
import { RECOMMENDATION_LABEL, RECOMMENDATION_CLASS, type ProfitabilityRecommendation } from "@/lib/profitability/labels";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { TableScroller } from "@/components/TableScroller";
import type { ExportColumn } from "@/lib/export/csv";

export type CampaignRow = {
  id: string;
  name: string;
  status: string | null;
  objective: string | null;
  adAccountName: string;
  propertyName: string | null;
  city: string | null;
  spend: number;
  impressions: number;
  leads: number;
  cpl: number | null;
  health: HealthStatus;
  recommendation: ProfitabilityRecommendation | null;
};

type Option = { id: string; name: string };

const EXPORT_COLUMNS: ExportColumn<CampaignRow>[] = [
  { key: "name", label: "Campaign" },
  { key: "adAccountName", label: "Account" },
  { key: "status", label: "Status" },
  { key: "spend", label: "Spend" },
  { key: "impressions", label: "Impressions" },
  { key: "leads", label: "Leads" },
  { key: "cpl", label: "CPL" },
  { key: "propertyName", label: "Property" },
  { key: "city", label: "City" },
  { key: "recommendation", label: "Recommendation" },
];

// Very subtle full-row tint by recommendation (design review item 11) —
// deliberately faint so the row is still primarily readable as data, not a
// colored block.
const ROW_TINT_CLASS: Record<ProfitabilityRecommendation, string> = {
  continue: "bg-good-tint",
  monitor: "bg-warn-tint",
  reduce_budget: "bg-reduce-tint",
  pause: "bg-bad-tint",
};

export function CampaignTable({ rows, properties }: { rows: CampaignRow[]; properties: Option[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [openPropertyPopover, setOpenPropertyPopover] = useState<string | null>(null);
  const [untaggingId, setUntaggingId] = useState<string | null>(null);

  function untagProperty(campaignId: string) {
    setUntaggingId(campaignId);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("campaign_id", campaignId);
      fd.append("property_id", "__clear__");
      await bulkTagCampaigns(fd);
      setUntaggingId(null);
      setOpenPropertyPopover(null);
    });
  }

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
          <select name="property_id" className="rounded-md border border-border bg-background px-2 py-1 text-foreground" defaultValue="">
            <option value="">Property…</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
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
        <table className="w-full min-w-[950px] text-left text-sm">
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
              <th className="px-3 py-2">Property</th>
              <th className="px-3 py-2">City</th>
              <th className="px-3 py-2">Recommendation</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className={`border-t border-border ${r.recommendation ? ROW_TINT_CLASS[r.recommendation] : ""}`}
              >
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
                <td className="relative px-3 py-2 text-muted">
                  {r.propertyName ? (
                    <>
                      <button
                        type="button"
                        className="hover:underline"
                        onClick={() => setOpenPropertyPopover(openPropertyPopover === r.id ? null : r.id)}
                      >
                        {r.propertyName}
                      </button>
                      {openPropertyPopover === r.id && (
                        <div className="absolute left-0 top-full z-10 mt-1 w-40 rounded-md border border-border bg-surface p-2 text-xs shadow-lg">
                          <button
                            type="button"
                            disabled={isPending && untaggingId === r.id}
                            onClick={() => untagProperty(r.id)}
                            className="w-full rounded px-2 py-1 text-left text-bad hover:bg-bad-tint disabled:opacity-50"
                          >
                            {isPending && untaggingId === r.id ? "Removing…" : "Remove property tag"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setOpenPropertyPopover(null)}
                            className="mt-1 w-full rounded px-2 py-1 text-left text-muted hover:bg-row-hover"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2 text-muted">{r.city ?? "—"}</td>
                <td className="px-3 py-2">
                  {r.recommendation ? (
                    <span className={`rounded px-1.5 py-0.5 text-xs font-bold ${RECOMMENDATION_CLASS[r.recommendation]}`}>
                      {RECOMMENDATION_LABEL[r.recommendation]}
                    </span>
                  ) : (
                    <span className="text-xs text-faint">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroller>
    </div>
  );
}
