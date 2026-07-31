-- Sprint 5: Budget Tracking & Pacing (Section 9.8) + Alerts engine support
-- (Sections 9.11, 17).

-- ---------------------------------------------------------------------------
-- 1. Campaign-level budget snapshot. Modeled as columns on `campaign` (not
--    daily_metrics, despite daily_metrics having budget/budget_utilization_pct
--    placeholders from Sprint 1) because budget is fundamentally a current
--    campaign attribute refreshed each sync, not a historical daily fact —
--    Meta doesn't report "what the budget was on day X," only "what it is
--    now." The Sprint 1 daily_metrics.budget columns are left unused rather
--    than removed, in case a future sprint wants a historical budget-change
--    log.
-- ---------------------------------------------------------------------------

alter table campaign add column if not exists daily_budget numeric;
alter table campaign add column if not exists lifetime_budget numeric;
alter table campaign add column if not exists budget_remaining numeric;
alter table campaign add column if not exists budget_synced_at timestamptz;

-- Runtime status (DISAPPROVED, WITH_ISSUES, PENDING_REVIEW, etc.) distinct
-- from the configured `status` column — feeds the "Campaign rejected" alert.
alter table campaign add column if not exists effective_status text;

-- ---------------------------------------------------------------------------
-- 1b. Per-workspace alert thresholds (Section 9.11: "configurable thresholds
--     per workspace"). Sprint 1's comment on the alert table deferred this
--     to Sprint 5 — this is that. jsonb for MVP speed (see docs/DATA_MODEL.md
--     §6 on avoiding premature normalization); a dedicated table is only
--     worth it if query patterns demand it later.
-- ---------------------------------------------------------------------------

alter table workspace add column if not exists alert_thresholds jsonb not null default '{}';

-- ---------------------------------------------------------------------------
-- 2. Alerts: acknowledged_at/by, distinct from resolved_at/by (Section 9.11
--    "Acknowledge / Resolve / Escalate workflow" — Sprint 1's alert table
--    only had the resolve half).
-- ---------------------------------------------------------------------------

alter table alert add column if not exists acknowledged_at timestamptz;
alter table alert add column if not exists acknowledged_by uuid references auth.users(id);
