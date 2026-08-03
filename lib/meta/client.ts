/**
 * Meta Marketing API client (docs/ARCHITECTURE.md §4). Pinned to a specific
 * API version deliberately — bump it on a quarterly review, not
 * automatically, per docs/DEVELOPMENT_PLAN.md's cross-cutting workstreams.
 */
const META_API_VERSION = "v21.0";
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

// Meta error codes that indicate rate limiting / transient throttling —
// retry these with backoff. Anything else (bad token, permission denied,
// invalid ad account) is not retryable.
const RATE_LIMIT_ERROR_CODES = new Set([4, 17, 32, 613]);

export class MetaApiError extends Error {
  code?: number;
  isRateLimit: boolean;

  constructor(message: string, code?: number, isRateLimit = false) {
    super(message);
    this.name = "MetaApiError";
    this.code = code;
    this.isRateLimit = isRateLimit;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function metaApiGet(
  path: string,
  params: Record<string, string>,
  accessToken: string,
  maxRetries = 4
): Promise<Record<string, unknown>> {
  const url = new URL(`${META_API_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", accessToken);

  let attempt = 0;
  for (;;) {
    const res = await fetch(url.toString());
    const body = await res.json();

    if (res.ok) return body;

    const errCode = body?.error?.code as number | undefined;
    const isRateLimit = res.status === 429 || (errCode !== undefined && RATE_LIMIT_ERROR_CODES.has(errCode));

    if (isRateLimit && attempt < maxRetries) {
      const backoffMs = 2 ** attempt * 1000;
      await sleep(backoffMs);
      attempt++;
      continue;
    }

    throw new MetaApiError(
      body?.error?.message ?? `Meta API request failed with status ${res.status}`,
      errCode,
      isRateLimit
    );
  }
}

async function fetchAllPages(
  path: string,
  params: Record<string, string>,
  accessToken: string
): Promise<Record<string, unknown>[]> {
  const results: Record<string, unknown>[] = [];
  let nextUrl: string | null = null;
  let currentPath = path;
  let currentParams = params;

  for (;;) {
    const body: Record<string, unknown> = nextUrl
      ? await (async () => {
          const res = await fetch(nextUrl!);
          return res.json();
        })()
      : await metaApiGet(currentPath, currentParams, accessToken);

    const data = (body.data as Record<string, unknown>[]) ?? [];
    results.push(...data);

    const next = (body.paging as { next?: string } | undefined)?.next;
    if (!next) break;
    nextUrl = next;
    currentPath = "";
    currentParams = {};
  }

  return results;
}

export type MetaCampaign = {
  id: string;
  name: string;
  objective?: string;
  status?: string;
  buying_type?: string;
  // Budget fields (Section 9.8) — Meta returns these as strings in the ad
  // account's currency's MINOR unit (e.g. paise for INR, cents for USD),
  // unlike Insights' `spend`, which is already in major units. Divided by
  // 100 in lib/meta/sync.ts. Flagged for reconciliation against Ads
  // Manager the same way Sprint 2's spend/impressions numbers were —
  // this hasn't been visually confirmed against a live account yet.
  daily_budget?: string;
  lifetime_budget?: string;
  budget_remaining?: string;
  // Runtime status distinct from `status` (the configured status) — this is
  // where rejection/review states like DISAPPROVED, PENDING_REVIEW,
  // WITH_ISSUES show up (Section 17 "Campaign rejected" alert).
  effective_status?: string;
};

export async function fetchCampaigns(adAccountId: string, accessToken: string): Promise<MetaCampaign[]> {
  const data = await fetchAllPages(
    `/${adAccountId}/campaigns`,
    {
      fields:
        "id,name,objective,status,effective_status,buying_type,daily_budget,lifetime_budget,budget_remaining",
      limit: "200",
    },
    accessToken
  );
  return data as unknown as MetaCampaign[];
}

export type MetaAdSet = { id: string; name: string; status?: string };

/** Live drill-down for the Campaign Detail view (Section 9.3) — fetched
 * on-demand for one campaign, not stored, unlike the daily sync. */
export async function fetchAdSetsForCampaign(metaCampaignId: string, accessToken: string): Promise<MetaAdSet[]> {
  const data = await fetchAllPages(`/${metaCampaignId}/adsets`, { fields: "id,name,status", limit: "100" }, accessToken);
  return data as unknown as MetaAdSet[];
}

export type MetaAd = {
  id: string;
  name: string;
  status?: string;
  adset_id?: string;
  creative?: { thumbnail_url?: string; title?: string; body?: string };
};

export async function fetchAdsForCampaign(metaCampaignId: string, accessToken: string): Promise<MetaAd[]> {
  const data = await fetchAllPages(
    `/${metaCampaignId}/ads`,
    { fields: "id,name,status,adset_id,creative{thumbnail_url,title,body}", limit: "100" },
    accessToken
  );
  return data as unknown as MetaAd[];
}

export type MetaInsightRow = {
  campaign_id: string;
  date_start: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  frequency?: string;
  cpm?: string;
  ctr?: string;
  unique_ctr?: string;
  cpc?: string;
  clicks?: string;
  actions?: { action_type: string; value: string }[];
};

export async function fetchInsights(
  adAccountId: string,
  accessToken: string,
  since: string,
  until: string
): Promise<MetaInsightRow[]> {
  const data = await fetchAllPages(
    `/${adAccountId}/insights`,
    {
      level: "campaign",
      time_range: JSON.stringify({ since, until }),
      time_increment: "1",
      fields:
        "campaign_id,spend,impressions,reach,frequency,cpm,ctr,unique_ctr,cpc,clicks,actions",
      limit: "500",
    },
    accessToken
  );
  return data as unknown as MetaInsightRow[];
}

/** Sums the lead-like action types Meta reports under `actions`. */
export function extractLeadCount(actions?: { action_type: string; value: string }[]): number {
  if (!actions) return 0;
  const leadActionTypes = new Set([
    "lead",
    "onsite_conversion.lead_grouped",
    "offsite_conversion.fb_pixel_lead",
    "leadgen_grouped",
  ]);
  return actions
    .filter((a) => leadActionTypes.has(a.action_type))
    .reduce((sum, a) => sum + (parseFloat(a.value) || 0), 0);
}
