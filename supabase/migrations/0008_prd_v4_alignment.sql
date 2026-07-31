-- PRD v4.0 alignment. Key changes from v1.0:
--   - Personas reduced to 5: CEO, Marketing Director, Marketing Manager,
--     Data Analyst, Administrator. Supervisor/Campaign Executive are gone
--     for good (0007 already removed them) — but "Marketing Manager"
--     comes BACK here with full-workspace scope (flat org model, Section
--     5.1), not the per-person scoping the old Manager persona had.
--   - Campaign naming auto-parse is explicitly forbidden now (Section 5.1:
--     "the system will not attempt to auto-parse campaign names") —
--     handled in application code (Sprint removal), not this migration.
--   - City becomes an independent bulk-taggable campaign attribute
--     (Section 9.2), not just inherited via Property.
--   - New module: Campaign Profitability & Continue/Pause Advisor
--     (Section 9.10) — profitability_snapshot entity + workspace-configurable
--     thresholds.

-- ---------------------------------------------------------------------------
-- 1. Restore the Marketing Manager role template (full-workspace scope).
-- ---------------------------------------------------------------------------

insert into role (workspace_id, name, is_system_template)
values (null, 'Marketing Manager', true)
on conflict (name) where workspace_id is null do nothing;

-- Re-seed permissions for all 5 roles per the PRD v4 Section 21 RBAC matrix
-- (View / Edit / Delete / Export / Approve / Manage). Clears and rebuilds
-- rather than incrementally patching, since the matrix changed meaningfully
-- (e.g. Marketing Director's Approve, CEO's budget-shift Approve).
do $$
declare
  r_ceo uuid; r_director uuid; r_manager uuid; r_analyst uuid; r_admin uuid;
begin
  select id into r_ceo from role where workspace_id is null and name = 'CEO';
  select id into r_director from role where workspace_id is null and name = 'Marketing Director';
  select id into r_manager from role where workspace_id is null and name = 'Marketing Manager';
  select id into r_analyst from role where workspace_id is null and name = 'Data Analyst';
  select id into r_admin from role where workspace_id is null and name = 'Administrator';

  delete from permission where role_id in (r_ceo, r_director, r_manager, r_analyst, r_admin);

  insert into permission (role_id, resource, action) values
    (r_ceo, 'workspace', 'view_all'), (r_ceo, 'workspace', 'export'), (r_ceo, 'workspace', 'approve'),
    (r_director, 'workspace', 'view_all'), (r_director, 'workspace', 'edit'), (r_director, 'workspace', 'export'), (r_director, 'workspace', 'approve'),
    (r_manager, 'workspace', 'view_all'), (r_manager, 'workspace', 'edit'), (r_manager, 'workspace', 'export'),
    (r_analyst, 'workspace', 'view_all'), (r_analyst, 'workspace', 'export'),
    (r_admin, 'workspace', 'view_all'), (r_admin, 'settings', 'manage'), (r_admin, 'users', 'manage')
  on conflict do nothing;
end $$;

-- ---------------------------------------------------------------------------
-- 2. City as an independent bulk-taggable campaign attribute.
-- ---------------------------------------------------------------------------

alter table campaign add column if not exists city text;

-- ---------------------------------------------------------------------------
-- 3. Campaign Profitability & Continue/Pause Advisor (Section 9.10).
-- ---------------------------------------------------------------------------

alter table workspace add column if not exists profitability_thresholds jsonb not null default '{}';

create table if not exists profitability_snapshot (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id) on delete cascade,
  campaign_id uuid not null references campaign(id) on delete cascade,
  evaluated_at timestamptz not null default now(),
  spend_to_date numeric not null,
  leads_to_date bigint not null,
  cpl numeric,
  estimated_revenue numeric,
  estimated_profit_loss numeric,
  classification text not null, -- 'profitable' | 'break_even' | 'loss_making'
  recommendation text not null, -- 'continue' | 'monitor' | 'reduce_budget' | 'pause'
  reason text not null,
  days_below_break_even integer not null default 0
);
create index if not exists idx_profitability_snapshot_campaign_latest
  on profitability_snapshot (campaign_id, evaluated_at desc);

alter table profitability_snapshot enable row level security;

drop policy if exists "workspace_isolation_select" on profitability_snapshot;
create policy "workspace_isolation_select" on profitability_snapshot
  for select using (
    workspace_id in (select workspace_id from workspace_member where user_id = auth.uid())
  );
-- Writes happen only from the server (service_role, bypasses RLS) as part
-- of the evaluation job — no write policy needed for authenticated users.
