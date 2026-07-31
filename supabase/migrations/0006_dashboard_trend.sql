-- Sprint 6-7: Dashboards (Section 9.1, 11). campaign_metrics_summary
-- (0003) collapses a range into one total per campaign — perfect for
-- leaderboards, but the CEO/Director dashboard's 30-day trend line needs
-- per-day totals across the whole workspace instead.

create or replace function workspace_daily_trend(p_workspace_id uuid, p_since date, p_until date)
returns table (date date, total_spend numeric, total_leads bigint)
language sql
stable
as $$
  select
    dm.date,
    sum(dm.spend) as total_spend,
    sum(dm.leads) as total_leads
  from daily_metrics dm
  where dm.workspace_id = p_workspace_id and dm.date between p_since and p_until
  group by dm.date
  order by dm.date;
$$;
