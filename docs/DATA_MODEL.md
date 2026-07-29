# Data Model

Elaborates PRD Section 18 (Data Model & ER Diagram) and Section 19 (Database Design) into a concrete DDL sketch.
This is a starting schema for Sprint 1 — refine field lists during implementation, but do not change the entity
boundaries or the `workspace_id`-everywhere pattern without updating this doc.

## 1. Entity List (from PRD Section 18.1)

Workspace · Business Manager · Ad Account · Campaign · Ad Set · Ad · Creative · Audience · Pixel · Lead · Property ·
Sales Team / Employee · Customer · Daily Metrics · Historical Metrics · Alert · Notification · Audit Log ·
Role / Permission

## 2. Core Relationships (from PRD Section 18.2)

```
Workspace 1—* Business Manager 1—* Ad Account 1—* Campaign 1—* Ad Set 1—* Ad *—1 Creative
Campaign *—1 Property
Campaign *—1 Manager/Supervisor/Executive (via Sales Team)
Campaign 1—* Daily Metrics (time-series fact table)
Campaign 1—* Lead, Lead *—1 Property, Lead *—0..1 Customer (once CRM-linked)
Ad Account 1—* Pixel, Pixel 1—* Lead (landing-page-sourced leads)
Campaign/Account 1—* Alert, Alert 1—* Notification, Notification *—1 User
Workspace 1—* User, User *—1 Role, Role 1—* Permission
```

> An ER diagram artifact (visual) is intentionally left as a to-be-rendered deliverable per the PRD's own appendix
> note (Section 18.2/29.2) — generate it as a Mermaid or draw.io diagram once the schema below stabilizes in Sprint 1.

## 3. DDL Sketch

```sql
-- All tables use UUID primary keys (Supabase convention, Section 19).

create table workspace (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency text not null default 'INR',
  timezone text not null default 'Asia/Kolkata',
  branding jsonb, -- logo url, primary color -- white-label theme variables (Section 22)
  alert_thresholds jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table workspace_member (
  workspace_id uuid not null references workspace(id),
  user_id uuid not null references auth.users(id),
  role_id uuid not null references role(id),
  primary key (workspace_id, user_id)
);

create table role (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspace(id), -- null = system-defined role template
  name text not null -- CEO, Director, Manager, Supervisor, Executive, Analyst, Admin
);

create table permission (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references role(id),
  resource text not null,
  action text not null -- view | edit | delete | export | approve | manage
);

create table business_manager (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id),
  meta_bm_id text not null,
  system_user_token_secret_ref text not null -- pointer into encrypted secret store, never plaintext
);

create table ad_account (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id),
  business_manager_id uuid not null references business_manager(id),
  meta_ad_account_id text not null,
  name text not null,
  currency text not null
);

create table property (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id),
  name text not null,
  city text,
  state text,
  country text,
  assumed_conversion_rate numeric, -- for Estimated ROI (Section 5.1)
  assumed_avg_deal_value numeric
);

create table sales_team_employee (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id),
  user_id uuid references auth.users(id),
  name text not null,
  role text not null, -- Manager | Supervisor | Executive
  reports_to uuid references sales_team_employee(id)
);

create table campaign (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id),
  ad_account_id uuid not null references ad_account(id),
  meta_campaign_id text not null,
  name text not null,
  objective text,
  status text,
  buying_type text,
  property_id uuid references property(id),
  manager_id uuid references sales_team_employee(id),
  executive_id uuid references sales_team_employee(id),
  tagging_source text not null default 'manual', -- 'naming_convention' | 'manual'
  created_at timestamptz not null default now()
);

create table ad_set (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id),
  campaign_id uuid not null references campaign(id),
  meta_ad_set_id text not null,
  name text not null,
  audience_id uuid references audience(id)
);

create table audience (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id),
  definition jsonb not null -- age, gender, placement, device targeting spec
);

create table creative (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id),
  type text not null, -- image | video | carousel
  thumbnail_url text,
  copy_text text
);

create table ad (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id),
  ad_set_id uuid not null references ad_set(id),
  meta_ad_id text not null,
  creative_id uuid references creative(id)
);

create table pixel (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id),
  ad_account_id uuid not null references ad_account(id),
  meta_pixel_id text not null,
  last_event_at timestamptz -- drives "Pixel inactive" alert (Section 17)
);

create table customer (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id),
  crm_reference text, -- populated once CRM integration provides post-lead sales data
  deal_value numeric,
  closed_at timestamptz
);

create table lead (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id),
  campaign_id uuid not null references campaign(id),
  property_id uuid references property(id),
  source text not null, -- 'meta_lead_form' | 'landing_page_webhook'
  pixel_id uuid references pixel(id), -- set only when source = landing_page_webhook
  quality_tag text, -- MVP: manual/CRM-synced tag; Phase 2: modeled score
  created_at timestamptz not null default now()
);

-- Core fact table -- hot path for every dashboard query.
create table daily_metrics (
  workspace_id uuid not null references workspace(id),
  campaign_id uuid not null references campaign(id),
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
  delivery_status text, -- includes 'learning_limited'
  estimated_roi numeric,
  primary key (workspace_id, campaign_id, date)
);
create index idx_daily_metrics_hot_path on daily_metrics (workspace_id, campaign_id, date);

-- Same shape as daily_metrics; populated by the monthly archival job (Section 19).
create table historical_metrics (like daily_metrics including all);

create table alert (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id),
  campaign_id uuid references campaign(id),
  ad_account_id uuid references ad_account(id),
  rule_key text not null, -- one of the 12 rule keys in Section 17
  severity text not null, -- 'amber' | 'red'
  status text not null default 'open', -- 'open' | 'acknowledged' | 'resolved' | 'escalated'
  triggered_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id)
);

create table notification (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id),
  alert_id uuid references alert(id),
  report_id uuid, -- nullable FK to a future `report` table if reports are persisted as rows
  user_id uuid not null references auth.users(id),
  channel text not null, -- 'email' | 'whatsapp' | 'in_app'
  sent_at timestamptz,
  read_at timestamptz
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id),
  user_id uuid references auth.users(id),
  action text not null, -- 'login' | 'export' | 'settings_change' | 'alert_acknowledge' | 'role_change' | ...
  details jsonb,
  created_at timestamptz not null default now()
);
```

## 4. Indexing & Partitioning (Section 19)

- **Hot path index:** `(workspace_id, campaign_id, date)` composite on `daily_metrics` — every dashboard query
  filters on this triple.
- **Partitioning:** not required at MVP launch (300+ campaigns/day is well within single-table Postgres limits), but
  the schema is partition-ready — plan to partition `daily_metrics`/`historical_metrics` by month once volume passes
  ~6–12 months of history at 300+ campaigns/day.
- **Archiving:** monthly job rolls rows older than 13 months from `daily_metrics` into `historical_metrics`;
  dashboards query `historical_metrics` transparently for date ranges that cross the boundary.
- **Retention:** preserve raw daily granularity for 24 months minimum (real estate sales cycles are long);
  aggregate-only beyond that, consistent with Meta's own ~37-month API retention ceiling (Section 5.2).

## 5. Row-Level Security Policy Pattern

Applied identically to every table above that carries `workspace_id` (i.e., all of them except `role` templates and
`permission`, which key off `role_id`):

```sql
alter table campaign enable row level security;

create policy "workspace_isolation" on campaign
  for all using (
    workspace_id in (
      select workspace_id from workspace_member where user_id = auth.uid()
    )
  );
```

RBAC-level restrictions (e.g., an Executive seeing only their own campaigns, a Manager not seeing another Manager's
compensation-linked KPIs) are layered as **additional** policy conditions referencing `sales_team_employee` and
`permission`, on top of — never instead of — the workspace isolation policy.

## 6. Open Schema Questions for Sprint 1

- Should `report` (generated report instances) be a first-class table, or are reports purely computed-on-demand and
  only their delivery tracked via `notification`? Recommend a first-class `report` table once the Reports Centre
  (PRD Section 12) needs a "list of generated reports" with download/resend — track as a Sprint 7 decision.
- `workspace.branding` and `workspace.alert_thresholds` are sketched as `jsonb` for MVP speed; revisit as dedicated
  tables only if query patterns demand it (avoid premature normalization).
