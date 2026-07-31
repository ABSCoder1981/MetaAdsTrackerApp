-- Sprint 3: Campaign Monitoring (PRD Section 9.2) support.
--
-- Aggregating 900+ campaigns' daily_metrics on the client would mean
-- shipping thousands of raw rows to render one table — this RPC does the
-- summing/latest-row lookup in Postgres instead, matching the "pre-computed
-- rollups, not live client-side aggregation" NFR (docs/ARCHITECTURE.md §5),
-- scoped down to a request-time range rather than the daily sync job.
--
-- LANGUAGE SQL functions run SECURITY INVOKER by default (unlike the Vault
-- wrappers in 0002, which deliberately use SECURITY DEFINER) — so RLS on
-- daily_metrics still applies based on the calling user's session. A
-- workspace_id the caller doesn't belong to simply yields zero rows.

create or replace function campaign_metrics_summary(p_workspace_id uuid, p_since date, p_until date)
returns table (
  campaign_id uuid,
  total_spend numeric,
  total_impressions bigint,
  total_leads bigint,
  computed_cpl numeric,
  latest_ctr numeric,
  latest_frequency numeric,
  latest_date date
)
language sql
stable
as $$
  with agg as (
    select
      dm.campaign_id,
      sum(dm.spend) as total_spend,
      sum(dm.impressions) as total_impressions,
      sum(dm.leads) as total_leads
    from daily_metrics dm
    where dm.workspace_id = p_workspace_id and dm.date between p_since and p_until
    group by dm.campaign_id
  ),
  latest as (
    select distinct on (dm.campaign_id) dm.campaign_id, dm.ctr, dm.frequency, dm.date
    from daily_metrics dm
    where dm.workspace_id = p_workspace_id and dm.date between p_since and p_until
    order by dm.campaign_id, dm.date desc
  )
  select
    agg.campaign_id,
    agg.total_spend,
    agg.total_impressions,
    agg.total_leads,
    case when agg.total_leads > 0 then agg.total_spend / agg.total_leads else null end as computed_cpl,
    latest.ctr as latest_ctr,
    latest.frequency as latest_frequency,
    latest.date as latest_date
  from agg
  join latest using (campaign_id);
$$;
