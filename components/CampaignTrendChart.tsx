"use client";

import { MiniLineChart } from "@/components/charts/MiniLineChart";

export type TrendPoint = {
  date: string;
  spend: number;
  ctr: number | null;
  cpl: number | null;
};

export function CampaignTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <MiniLineChart data={data} dataKey="spend" label="Spend" valueFormatter={(v) => v.toFixed(0)} />
      <MiniLineChart data={data} dataKey="ctr" label="CTR %" valueFormatter={(v) => v.toFixed(2)} />
      <MiniLineChart data={data} dataKey="cpl" label="Cost per Lead" valueFormatter={(v) => v.toFixed(0)} />
    </div>
  );
}
