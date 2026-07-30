-- Sprint 1: full core schema (docs/DATA_MODEL.md §1-3), replacing the
-- Sprint 0 template's minimal workspace_member.role text column with a
-- proper role/permission model so RBAC (PRD Section 21) is encoded at the
-- database layer, not just in application code.
--
-- Safe to run against the Sprint 0 database: workspace/workspace_member
-- exist with no real rows yet (the only insert attempt was rejected by RLS
-- in Sprint 0's verification script), so we alter them in place rather than
-- drop/recreate.

-- ---------------------------------------------------------------------------
-- 1. Role & Permission (PRD Section 21 RBAC matrix)
-- ---------------------------------------------------------------------------

create table if not exists role (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspace(id) on delete cascade, -- null = system template
  name text not null,
  is_system_template boolean not null default false,
  unique (workspace_id, name)
);

-- Postgres treats multiple NULLs as distinct, so the (workspace_id, name)
-- unique constraint above does NOT stop duplicate system templates (all of
-- which have workspace_id = null) if this migration is accidentally run
-- twice. This partial index closes that gap specifically for templates.
create unique index if not exists idx_role_system_template_name
  on role (name) where workspace_id is null;

create table if not exists permission (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references role(id) on delete cascade,
  resource text not null,
  action text not null, -- 'view_all' | 'view_assigned' | 'edit' | 'delete' | 'export' | 'approve' | 'manage'
  unique (role_id, resource, action)
);

-- System role templates (workspace_id null) — one row per PRD Section 7 persona.
-- Real workspaces reference these via role.name lookups when assigning members
-- (see create_workspace_with_owner below); Sprint 9 (Admin & Role Management)
-- is where workspaces get the option to clone/customize these per-workspace.
insert into role (workspace_id, name, is_system_template) values
  (null, 'CEO', true),
  (null, 'Marketing Director', true),
  (null, 'Marketing Manager', true),
  (null, 'Supervisor', true),
  (null, 'Campaign Executive', true),
  (null, 'Data Analyst', true),
  (null, 'Administrator', true)
on conflict (name) where workspace_id is null do nothing;

-- Permissions per the RBAC matrix (PRD Section 21). Coarse-grained resources
-- for Sprint 1 — fine-grained per-module permissions get added as each epic
-- (Sections 9.2-9.16) lands, rather than speculatively modeled now.
do $$
declare
  r_ceo uuid; r_director uuid; r_manager uuid; r_supervisor uuid;
  r_exec uuid; r_analyst uuid; r_admin uuid;
begin
  select id into r_ceo from role where workspace_id is null and name = 'CEO';
  select id into r_director from role where workspace_id is null and name = 'Marketing Director';
  select id into r_manager from role where workspace_id is null and name = 'Marketing Manager';
  select id into r_supervisor from role where workspace_id is null and name = 'Supervisor';
  select id into r_exec from role where workspace_id is null and name = 'Campaign Executive';
  select id into r_analyst from role where workspace_id is null and name = 'Data Analyst';
  select id into r_admin from role where workspace_id is null and name = 'Administrator';

  insert into permission (role_id, resource, action) values
    (r_ceo, 'workspace', 'view_all'), (r_ceo, 'workspace', 'export'), (r_ceo, 'workspace', 'approve'),
    (r_director, 'workspace', 'view_all'), (r_director, 'workspace', 'edit'), (r_director, 'workspace', 'export'), (r_director, 'workspace', 'approve'),
    (r_manager, 'workspace', 'view_assigned'), (r_manager, 'workspace', 'edit'), (r_manager, 'workspace', 'export'),
    (r_supervisor, 'workspace', 'view_assigned'), (r_supervisor, 'alerts', 'edit'),
    (r_exec, 'workspace', 'view_own'), (r_exec, 'campaigns', 'edit'),
    (r_analyst, 'workspace', 'view_all'), (r_analyst, 'workspace', 'export'),
    (r_admin, 'workspace', 'view_all'), (r_admin, 'settings', 'manage'), (r_admin, 'users', 'manage')
  on conflict do nothing;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Rework workspace_member to reference role_id instead of a free-text role
-- ---------------------------------------------------------------------------

alter table workspace_member add column if not exists role_id uuid references role(id);

-- Backfill any pre-existing rows (there shouldn't be any real ones yet) by
-- matching their old text role to a system template, defaulting to Admin.
update workspace_member wm
  set role_id = (
    select id from role
    where workspace_id is null
      and lower(name) = lower(coalesce(wm.role, 'Administrator'))
    limit 1
  )
  where role_id is null;

update workspace_member set role_id = (select id from role where workspace_id is null and name = 'Administrator')
  where role_id is null;

alter table workspace_member alter column role_id set not null;
alter table workspace_member drop column if exists role;

-- ---------------------------------------------------------------------------
-- 3. Business/ad structure
-- ---------------------------------------------------------------------------

create table if not exists business_manager (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id) on delete cascade,
  meta_bm_id text not null,
  system_user_token_secret_ref text,
  created_at timestamptz not null default now()
);

create table if not exists ad_account (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id) on delete cascade,
  business_manager_id uuid not null references business_manager(id) on delete cascade,
  meta_ad_account_id text not null,
  name text not null,
  currency text not null default 'INR'
);

create table if not exists property (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id) on delete cascade,
  name text not null,
  city text,
  state text,
  country text,
  assumed_conversion_rate numeric,
  assumed_avg_deal_value numeric
);

create table if not exists sales_team_employee (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id) on delete cascade,
  user_id uuid references auth.users(id),
  name text not null,
  role text not null, -- 'Manager' | 'Supervisor' | 'Executive' (org-chart label, distinct from the RBAC `role` table)
  reports_to uuid references sales_team_employee(id)
);

create table if not exists campaign (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id) on delete cascade,
  ad_account_id uuid not null references ad_account(id) on delete cascade,
  meta_campaign_id text not null,
  name text not null,
  objective text,
  status text,
  buying_type text,
  property_id uuid references property(id),
  manager_id uuid references sales_team_employee(id),
  executive_id uuid references sales_team_employee(id),
  tagging_source text not null default 'manual',
  created_at timestamptz not null default now()
);

create table if not exists audience (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id) on delete cascade,
  definition jsonb not null default '{}'
);

create table if not exists creative (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id) on delete cascade,
  type text not null,
  thumbnail_url text,
  copy_text text
);

create table if not exists ad_set (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id) on delete cascade,
  campaign_id uuid not null references campaign(id) on delete cascade,
  meta_ad_set_id text not null,
  name text not null,
  audience_id uuid references audience(id)
);

create table if not exists ad (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id) on delete cascade,
  ad_set_id uuid not null references ad_set(id) on delete cascade,
  meta_ad_id text not null,
  creative_id uuid references creative(id)
);

create table if not exists pixel (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id) on delete cascade,
  ad_account_id uuid not null references ad_account(id) on delete cascade,
  meta_pixel_id text not null,
  last_event_at timestamptz
);

create table if not exists customer (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id) on delete cascade,
  crm_reference text,
  deal_value numeric,
  closed_at timestamptz
);

create table if not exists lead (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id) on delete cascade,
  campaign_id uuid not null references campaign(id) on delete cascade,
  property_id uuid references property(id),
  source text not null,
  pixel_id uuid references pixel(id),
  quality_tag text,
  created_at timestamptz not null default now()
);

create table if not exists daily_metrics (
  workspace_id uuid not null references workspace(id) on delete cascade,
  campaign_id uuid not null references campaign(id) on delete cascade,
  date date not null,
  spend numeric not null default 0,
  impressions bigint not null default 0,
  reach bigint not null default 0,
  frequency numeric,
  cpm numeric,
  ctr numeric,
  unique_ctr numeric,
  cpc numeric,
  outbound_clicks bigint,
  landing_page_views bigint,
  video_views bigint,
  hook_rate numeric,
  leads bigint not null default 0,
  cpl numeric,
  budget numeric,
  budget_utilization_pct numeric,
  delivery_status text,
  estimated_roi numeric,
  primary key (workspace_id, campaign_id, date)
);
create index if not exists idx_daily_metrics_hot_path on daily_metrics (workspace_id, campaign_id, date);

create table if not exists historical_metrics (like daily_metrics including all);

create table if not exists alert (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id) on delete cascade,
  campaign_id uuid references campaign(id) on delete cascade,
  ad_account_id uuid references ad_account(id) on delete cascade,
  rule_key text not null,
  severity text not null,
  status text not null default 'open',
  triggered_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id)
);

create table if not exists notification (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id) on delete cascade,
  alert_id uuid references alert(id) on delete cascade,
  report_id uuid,
  user_id uuid not null references auth.users(id),
  channel text not null,
  sent_at timestamptz,
  read_at timestamptz
);

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id) on delete cascade,
  user_id uuid references auth.users(id),
  action text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. Row-Level Security — the Sprint 0 template pattern applied to every
--    workspace-scoped table above.
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
  tables text[] := array[
    'business_manager', 'ad_account', 'property', 'sales_team_employee', 'campaign',
    'audience', 'creative', 'ad_set', 'ad', 'pixel', 'customer', 'lead',
    'daily_metrics', 'historical_metrics', 'alert', 'notification', 'audit_log'
  ];
begin
  foreach t in array tables loop
    execute format('alter table %I enable row level security', t);

    execute format('drop policy if exists "workspace_isolation_select" on %I', t);
    execute format(
      'create policy "workspace_isolation_select" on %I
         for select using (
           workspace_id in (select workspace_id from workspace_member where user_id = auth.uid())
         )', t
    );

    execute format('drop policy if exists "workspace_isolation_write" on %I', t);
    execute format(
      'create policy "workspace_isolation_write" on %I
         for all using (
           workspace_id in (select workspace_id from workspace_member where user_id = auth.uid())
         )
         with check (
           workspace_id in (select workspace_id from workspace_member where user_id = auth.uid())
         )', t
    );
  end loop;
end $$;

-- role/permission themselves: a user can read role/permission rows for
-- workspaces they belong to, plus the system templates (workspace_id null).
alter table role enable row level security;
alter table permission enable row level security;

drop policy if exists "role_select" on role;
create policy "role_select" on role
  for select using (
    workspace_id is null
    or workspace_id in (select workspace_id from workspace_member where user_id = auth.uid())
  );

drop policy if exists "permission_select" on permission;
create policy "permission_select" on permission
  for select using (
    role_id in (
      select id from role
      where workspace_id is null
        or workspace_id in (select workspace_id from workspace_member where user_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 5. Bootstrapping: new workspace's creator gets the Administrator role.
-- ---------------------------------------------------------------------------

create or replace function create_workspace_with_owner(workspace_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace_id uuid;
  admin_role_id uuid;
begin
  select id into admin_role_id from role where workspace_id is null and name = 'Administrator';

  insert into workspace (name) values (workspace_name) returning id into new_workspace_id;
  insert into workspace_member (workspace_id, user_id, role_id)
    values (new_workspace_id, auth.uid(), admin_role_id);

  insert into audit_log (workspace_id, user_id, action, details)
    values (new_workspace_id, auth.uid(), 'workspace_created', jsonb_build_object('name', workspace_name));

  return new_workspace_id;
end;
$$;
