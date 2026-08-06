# Data Model

Elaborates PRD Section 18 (Data Model & ER Diagram) and Section 19 (Database Design) into a concrete DDL sketch.
This was the starting schema for Sprint 1 — the entity boundaries and `workspace_id`-everywhere pattern held, but
the exact DDL below has since diverged from the live schema as the app evolved (`Sales Team / Employee` was
built, then removed; `Profitability Snapshot` was added; `Campaign` gained an independent `city` column). **The
`supabase/migrations/*.sql` files are the authoritative current schema** — this document explains the *shape* of
the data model, but see §7 below for what's changed since this sketch was written, and read the migrations for
exact current columns.

## 0. Schema Evolution (read this before trusting the DDL sketch below)

| Migration | What changed |
|---|---|
| `0001_core_schema.sql` | Implements most of the sketch below, including `sales_team_employee`. |
| `0002`–`0006` | Additive: Meta sync infra, campaign monitoring RPC, lead webhook, budget/alert columns, dashboard trend RPC. Don't change the entities described here. |
| `0007_remove_manager_executive.sql` | **Removes** `sales_team_employee` entirely, and `campaign.manager_id`/`executive_id`. See `DEVELOPMENT_PLAN.md`'s Deviation Log. |
| `0008_prd_v4_alignment.sql` | Adds `campaign.city` (independent tag, not derived from Property — PRD v4 Section 9.2), adds the **Profitability Snapshot** entity (`profitability_snapshot` table) and `workspace.profitability_thresholds`, restores the Marketing Manager RBAC role (full-workspace scope — `sales_team_employee` stays gone, this is just a `role` row). |
| `0009_workspace_settings.sql`, `0010_daily_metrics_clicks.sql` | Additive: workspace settings, raw `daily_metrics.clicks` for range-correct CTR/CPC/CPM. Don't change the entities described here. |
| `0011_two_role_model.sql` | **Collapses RBAC to 2 roles**: Administrator and User. Removes the CEO / Marketing Director / Marketing Manager / Data Analyst system role templates entirely (a further business decision beyond PRD v4.0's already-amended 5-persona model — see Deviation Log); any `workspace_member` on a removed role is reassigned to User. |
| `0012_remove_property.sql` | **Removes** the `property` table, `campaign.property_id`, `campaign.tagging_source`, `lead.property_id`, `profitability_snapshot`, and `workspace.profitability_thresholds` — the Property module and the Profitability Advisor it fed are both gone (business decision, further deviation beyond PRD v4.0 — see Deviation Log). `campaign.city` is untouched: it was never derived from Property. |

## 1. Entity List (from PRD Section 18.1, as amended by v4.0 — see §0)

Workspace · Business Manager · Ad Account · Campaign · Ad Set · Ad · Creative · Audience · Pixel · Lead ·
~~Sales Team / Employee~~ (removed, §0) · ~~Property~~ (removed, §0) · ~~Profitability Snapshot~~ (added in PRD v4
Section 18.1, removed, §0) · Customer · Daily Metrics · Historical Metrics · Alert · Notification · Audit Log ·
Role / Permission

## 2. Core Relationships (from PRD Section 18.2)

```
Workspace 1—* Business Manager 1—* Ad Account 1—* Campaign 1—* Ad Set 1—* Ad *—1 Creative
Campaign *—1 Manager/Supervisor/Executive (via Sales Team) — removed, §0
Campaign 1—* Daily Metrics (time-series fact table)
Campaign 1—* Lead, Lead *—0..1 Customer (once CRM-linked)
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
  name text not null -- current system templates (migration 0011): Administrator, User — see §0
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

-- REMOVED in migration 0007 (§0) — kept struck through here rather than
-- deleted from this doc, so the Deviation Log's history stays checkable.
-- do not recreate without re-reading DEVELOPMENT_PLAN.md's Deviation Log.
--
-- create table sales_team_employee (
--   id uuid primary key default gen_random_uuid(),
--   workspace_id uuid not null references workspace(id),
--   user_id uuid references auth.users(id),
--   name text not null,
--   role text not null, -- Manager | Supervisor | Executive
--   reports_to uuid references sales_team_employee(id)
-- );

-- REMOVED in migration 0012 (§0), along with campaign.property_id/
-- tagging_source and lead.property_id below — the Property module and the
-- Profitability Advisor it fed were both removed (business decision).
-- do not recreate without re-reading DEVELOPMENT_PLAN.md's Deviation Log.
--
-- create table property (
--   id uuid primary key default gen_random_uuid(),
--   workspace_id uuid not null references workspace(id),
--   name text not null,
--   city text,
--   state text,
--   country text,
--   assumed_conversion_rate numeric, -- for Estimated ROI (Section 5.1)
--   assumed_avg_deal_value numeric
-- );

-- v4.0 update: manager_id/executive_id removed (§0, migration 0007); city
-- added as its own tag (§0, migration 0008) — PRD v4 Section 9.2: "manually
-- assign Property and City to campaigns... no automatic parsing of campaign
-- names." property_id/tagging_source removed in migration 0012 (§0) along
-- with the rest of the Property module.
create table campaign (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id),
  ad_account_id uuid not null references ad_account(id),
  meta_campaign_id text not null,
  name text not null,
  objective text,
  status text,
  buying_type text,
  city text,
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

-- Added in PRD v4.0 (§0, migration 0008) — Section 9.10's Profitability &
-- Continue/Pause Advisor. REMOVED in migration 0012 (§0) along with the
-- rest of the Property module, since its classification is defined
-- entirely by estimated_revenue, which has no meaning without Property's
-- assumed conversion rate / deal value. Kept struck through here rather
-- than deleted, so the Deviation Log's history stays checkable.
-- do not recreate without re-reading DEVELOPMENT_PLAN.md's Deviation Log.
--
-- create table profitability_snapshot (
--   id uuid primary key default gen_random_uuid(),
--   workspace_id uuid not null references workspace(id),
--   campaign_id uuid not null references campaign(id),
--   evaluated_at timestamptz not null default now(),
--   spend_to_date numeric not null,
--   leads_to_date bigint not null,
--   cpl numeric,
--   estimated_revenue numeric,
--   estimated_profit_loss numeric,
--   classification text not null, -- 'profitable' | 'break_even' | 'loss_making'
--   recommendation text not null, -- 'continue' | 'monitor' | 'reduce_budget' | 'pause'
--   reason text not null,          -- templated, not AI-generated (PRD explicit requirement)
--   days_below_break_even integer not null default 0
-- );

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

RBAC-level restrictions are layered as **additional** policy conditions referencing `permission`, on top of —
never instead of — the workspace isolation policy. (The per-person scoping example this section originally gave
— an Executive seeing only their own campaigns — no longer applies: PRD v4's flat org model means every business
role sees the full workspace, so RBAC restrictions in practice are about *action* type — view/edit/export/approve
— not row-level scoping beyond the workspace boundary itself.)

## 6. Open Schema Questions for Sprint 1

- Should `report` (generated report instances) be a first-class table, or are reports purely computed-on-demand and
  only their delivery tracked via `notification`? Recommend a first-class `report` table once the Reports Centre
  (PRD Section 12) needs a "list of generated reports" with download/resend — track as a Sprint 7 decision.
- `workspace.branding` and `workspace.alert_thresholds` are sketched as `jsonb` for MVP speed; revisit as dedicated
  tables only if query patterns demand it (avoid premature normalization).
