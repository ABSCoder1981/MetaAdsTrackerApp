"use client";

import { useState } from "react";

export type DeltaSet = {
  label: string;
  spend: { current: number; previous: number };
  leads: { current: number; previous: number };
};

function pctDelta(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? "+∞%" : "0%";
  const pct = ((current - previous) / previous) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%`;
}

function DeltaCard({ title, current, previous, formatter }: { title: string; current: number; previous: number; formatter: (n: number) => string }) {
  const delta = pctDelta(current, previous);
  const isUp = current >= previous;
  return (
    <div className="rounded border border-zinc-200 p-3 dark:border-zinc-800">
      <p className="text-xs uppercase text-zinc-500">{title}</p>
      <p className="text-lg font-semibold text-black dark:text-zinc-50">{formatter(current)}</p>
      <p className={`text-xs ${isUp ? "text-emerald-600" : "text-red-600"}`}>{delta} vs previous period</p>
    </div>
  );
}

export function DeltaToggle({ dod, wow }: { dod: DeltaSet; wow: DeltaSet }) {
  const [mode, setMode] = useState<"dod" | "wow">("dod");
  const active = mode === "dod" ? dod : wow;

  return (
    <div>
      <div className="mb-2 flex gap-2 text-sm">
        <button
          onClick={() => setMode("dod")}
          className={`rounded border px-3 py-1 ${mode === "dod" ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black" : "border-zinc-300 dark:border-zinc-700"}`}
        >
          Day over Day
        </button>
        <button
          onClick={() => setMode("wow")}
          className={`rounded border px-3 py-1 ${mode === "wow" ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black" : "border-zinc-300 dark:border-zinc-700"}`}
        >
          Week over Week
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <DeltaCard title="Spend" current={active.spend.current} previous={active.spend.previous} formatter={(n) => n.toFixed(0)} />
        <DeltaCard title="Leads" current={active.leads.current} previous={active.leads.previous} formatter={(n) => n.toFixed(0)} />
      </div>
    </div>
  );
}
