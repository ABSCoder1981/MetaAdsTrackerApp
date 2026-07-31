"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

export type TrendPoint = {
  date: string;
  spend: number;
  ctr: number | null;
  cpl: number | null;
};

const LINE_COLOR = "#256abf"; // dataviz skill palette, sequential blue step 500
const GRID_COLOR = "#e4e4e7"; // recessive gridlines (zinc-200)
const AXIS_COLOR = "#a1a1aa"; // recessive axis ticks (zinc-400)

function MiniLineChart({
  data,
  dataKey,
  label,
  valueFormatter,
}: {
  data: TrendPoint[];
  dataKey: keyof TrendPoint;
  label: string;
  valueFormatter: (v: number) => string;
}) {
  return (
    <div className="rounded border border-zinc-200 p-3 dark:border-zinc-800">
      <p className="mb-2 text-xs font-medium uppercase text-zinc-500">{label}</p>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID_COLOR} vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: AXIS_COLOR }}
            axisLine={{ stroke: GRID_COLOR }}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 11, fill: AXIS_COLOR }}
            axisLine={false}
            tickLine={false}
            width={40}
            tickFormatter={valueFormatter}
          />
          <Tooltip
            formatter={(value) => (typeof value === "number" ? valueFormatter(value) : String(value ?? ""))}
            contentStyle={{ fontSize: 12, borderRadius: 6 }}
          />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={LINE_COLOR}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CampaignTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <MiniLineChart data={data} dataKey="spend" label="Spend" valueFormatter={(v) => v.toFixed(0)} />
      <MiniLineChart data={data} dataKey="ctr" label="CTR %" valueFormatter={(v) => v.toFixed(2)} />
      <MiniLineChart data={data} dataKey="cpl" label="Cost per Lead" valueFormatter={(v) => v.toFixed(0)} />
    </div>
  );
}
