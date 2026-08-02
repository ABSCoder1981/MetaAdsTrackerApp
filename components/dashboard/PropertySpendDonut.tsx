"use client";

import { useState } from "react";
import Link from "next/link";

export type SpendSlice = { key: string; name: string; spend: number };

const SERIES_VAR = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)"];
const MAX_SLICES = 5;

/** Spend distribution across properties — categorical color (identity),
 * fixed hue order, legend always present, hover highlights the matching
 * segment. Beyond MAX_SLICES the smallest properties fold into "Other"
 * rather than cycling past the validated 5-slot palette. */
export function PropertySpendDonut({ slices }: { slices: SpendSlice[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  const sorted = [...slices].filter((s) => s.spend > 0).sort((a, b) => b.spend - a.spend);
  const top = sorted.slice(0, MAX_SLICES);
  const rest = sorted.slice(MAX_SLICES);
  const otherSpend = rest.reduce((sum, s) => sum + s.spend, 0);
  const rows = otherSpend > 0 ? [...top, { key: "__other__", name: "Other", spend: otherSpend }] : top;
  const total = rows.reduce((sum, r) => sum + r.spend, 0);

  if (total === 0) {
    return <p className="text-sm text-muted">No spend recorded in this range yet.</p>;
  }

  const R = 60;
  const STROKE = 22;
  const CIRC = 2 * Math.PI * R;
  const GAP = 3; // px gap between segments, per mark spec
  const cumulativeOffsets: number[] = [];
  rows.reduce((acc, r) => {
    cumulativeOffsets.push(acc);
    return acc + (r.spend / total) * CIRC;
  }, 0);

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 140 140" width="140" height="140" className="flex-shrink-0" role="img" aria-label="Spend distribution by property">
        <g transform="translate(70,70) rotate(-90)">
          <circle r={R} fill="none" stroke="var(--border)" strokeWidth={STROKE} />
          {rows.map((r, i) => {
            const frac = r.spend / total;
            const len = Math.max(frac * CIRC - GAP, 0);
            const dashArray = `${len} ${CIRC - len}`;
            const dashOffset = -cumulativeOffsets[i];
            const isOther = r.key === "__other__";
            const color = isOther ? "var(--faint)" : SERIES_VAR[i % SERIES_VAR.length];
            return (
              <circle
                key={r.key}
                r={R}
                fill="none"
                stroke={color}
                strokeWidth={STROKE}
                strokeDasharray={dashArray}
                strokeDashoffset={dashOffset}
                strokeLinecap="butt"
                opacity={hovered === null || hovered === i ? 1 : 0.35}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              >
                <title>{`${r.name}: ${r.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}</title>
              </circle>
            );
          })}
        </g>
        <text x="70" y="66" textAnchor="middle" className="fill-foreground" style={{ fontSize: 18, fontWeight: 700 }}>
          {total >= 100000 ? `${(total / 100000).toFixed(1)}L` : total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </text>
        <text x="70" y="82" textAnchor="middle" className="fill-faint" style={{ fontSize: 9, letterSpacing: 0.5 }}>
          TOTAL SPEND
        </text>
      </svg>

      <ul className="flex-1 space-y-2 text-sm">
        {rows.map((r, i) => {
          const isOther = r.key === "__other__";
          const color = isOther ? "var(--faint)" : SERIES_VAR[i % SERIES_VAR.length];
          const pct = ((r.spend / total) * 100).toFixed(0);
          const content = (
            <div
              className="flex items-center gap-2"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{ opacity: hovered === null || hovered === i ? 1 : 0.5 }}
            >
              <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: color }} />
              <span className="flex-1 truncate">{r.name}</span>
              <span className="tabular-nums text-faint">{pct}%</span>
            </div>
          );
          return (
            <li key={r.key}>
              {isOther ? content : (
                <Link href={`/dashboard/properties`} className="hover:underline">
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
