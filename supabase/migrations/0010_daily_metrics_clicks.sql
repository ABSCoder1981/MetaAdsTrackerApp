-- Adds a raw clicks count so CTR/CPC can be computed correctly over an
-- arbitrary date range. Meta's own daily ctr/cpc/cpm/frequency columns
-- (already present since 0001) are ratios computed for that single day —
-- correct for "today," but summing or averaging them across a range
-- produces a meaningless number. spend/impressions are raw totals and were
-- already range-summable (that's what CPM needs); clicks is the missing
-- raw total needed to make CTR (clicks/impressions) and CPC (spend/clicks)
-- range-summable the same way.
--
-- Historical rows will have clicks = null until the next sync re-pulls
-- them — lib/meta/client.ts and lib/meta/sync.ts are updated in the same
-- change to request/store it going forward.

alter table daily_metrics add column if not exists clicks bigint;

-- Extends campaign_metrics_summary (0003) with range-correct CTR/CPC/CPM,
-- computed from raw summable totals rather than averaging Meta's per-day
-- ratios. CPM only needed spend/impressions (already summable); CTR and CPC
-- were blocked on the missing clicks total added above. latest_frequency is
-- left as-is (still the single latest day's value) — reach isn't additive
-- across days (it's unique people, so summing daily reach double-counts
-- repeat viewers), so there's no correct way to derive a true period
-- frequency from what's stored; showing "latest day" and labeling it as
-- such in the UI is the honest option here, not a range average.
create or replace function campaign_metrics_summary(p_workspace_id uuid, p_since date, p_until date)
returns table (
  campaign_id uuid,
  total_spend numeric,
  total_impressions bigint,
  total_leads bigint,
  total_clicks bigint,
  computed_cpl numeric,
  computed_ctr numeric,
  computed_cpc numeric,
  computed_cpm numeric,
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
      sum(dm.leads) as total_leads,
      sum(dm.clicks) as total_clicks
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
    agg.total_clicks,
    case when agg.total_leads > 0 then agg.total_spend / agg.total_leads else null end as computed_cpl,
    case when agg.total_clicks > 0 and agg.total_impressions > 0
      then (agg.total_clicks::numeric / agg.total_impressions) * 100 else null end as computed_ctr,
    case when agg.total_clicks > 0 then agg.total_spend / agg.total_clicks else null end as computed_cpc,
    case when agg.total_impressions > 0 then (agg.total_spend / agg.total_impressions) * 1000 else null end as computed_cpm,
    latest.ctr as latest_ctr,
    latest.frequency as latest_frequency,
    latest.date as latest_date
  from agg
  join latest using (campaign_id);
$$;
