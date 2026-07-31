export type RangeKey = "today" | "yesterday" | "last7" | "last30";

export const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last7", label: "Last 7 Days" },
  { key: "last30", label: "Last 30 Days" },
];

/**
 * Resolves a Section 14 date-range filter key into concrete since/until
 * ISO date strings. Pulled out of the Campaigns page into its own module so
 * it's unit-testable without rendering a Server Component (see
 * lib/campaigns/dateRange.test.ts).
 */
export function resolveDateRange(rangeKey: string | undefined, now: Date = new Date()): { since: string; until: string; label: string } {
  const toISO = (d: Date) => d.toISOString().slice(0, 10);

  switch (rangeKey) {
    case "today":
      return { since: toISO(now), until: toISO(now), label: "Today" };
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { since: toISO(y), until: toISO(y), label: "Yesterday" };
    }
    case "last30": {
      const since = new Date(now);
      since.setDate(since.getDate() - 29);
      return { since: toISO(since), until: toISO(now), label: "Last 30 Days" };
    }
    case "last7":
    default: {
      const since = new Date(now);
      since.setDate(since.getDate() - 6);
      return { since: toISO(since), until: toISO(now), label: "Last 7 Days" };
    }
  }
}
