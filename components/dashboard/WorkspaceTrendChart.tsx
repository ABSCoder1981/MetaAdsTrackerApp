"use client";

import { MiniLineChart } from "@/components/charts/MiniLineChart";

export type WorkspaceTrendPoint = { date: string; spend: number; leads: number };

/** Section 11.1/11.2: "Spend trend line (30-day)" / "Spend & leads trend." */
export function WorkspaceTrendChart({ data }: { data: WorkspaceTrendPoint[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <MiniLineChart data={data} dataKey="spend" label="Spend" valueFormatter={(v) => v.toFixed(0)} />
      <MiniLineChart data={data} dataKey="leads" label="Leads" valueFormatter={(v) => v.toFixed(0)} />
    </div>
  );
}
