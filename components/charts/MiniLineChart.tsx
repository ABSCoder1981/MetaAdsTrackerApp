"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

// dataviz skill palette: sequential blue step 500, recessive grid/axis grays.
const LINE_COLOR = "#256abf";
const GRID_COLOR = "#e4e4e7";
const AXIS_COLOR = "#a1a1aa";

/**
 * Single-metric line chart — one axis, per the dataviz skill's no-dual-axis
 * rule. Used for any "N small single-series charts side by side" widget
 * (Campaign Detail's trend, the dashboards' spend/leads trend, etc.)
 * instead of duplicating this per screen.
 */
export function MiniLineChart<T extends Record<string, unknown>>({
  data,
  dataKey,
  label,
  valueFormatter,
}: {
  data: T[];
  dataKey: keyof T & string;
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
