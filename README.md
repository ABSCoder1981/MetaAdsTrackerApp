# Meta Ads Campaign Performance Tracker

Internal multi-tenant reporting & intelligence platform for Meta (Facebook) Ads — built for real estate marketing
operations, architected for white-label expansion.

This is a **read-only monitoring, analysis, and reporting layer** over Meta Ads Manager. It does not create, edit,
launch, or pause live ad campaigns.

## Status

✅ Sprint 0 (Foundation) complete — Next.js app live on Vercel, connected to a provisioned Supabase project, RLS
verified end-to-end.

✅ Sprint 1 (Core Schema & Auth) complete — full schema applied (all entities in `docs/DATA_MODEL.md`), RBAC
role/permission model seeded from PRD Section 21, email/password sign-in + sign-up, workspace creation/onboarding,
and a protected dashboard shell with a workspace switcher. Confirmed working with a real signed-in user in
production (not just the anon-level checks in `scripts/verify-sprint1-schema.mjs`).

✅ Sprint 2 (Meta API Integration) core pipeline complete and proven against **real production data** — the
pilot Ad Account synced 922 campaigns and 47 metric rows on first run via the "Connect an Ad Account" /
"Sync now" UI (`/dashboard/ad-accounts`). Meta System User tokens are stored encrypted in Supabase Vault, never
in a plain column or env var. **Pending before Rollout Stage 2:**
- Formal ±2% accuracy reconciliation against Ads Manager's own reported numbers (PRD Section 28 acceptance
  criterion) — the pipeline is demonstrably pulling correct campaign names/structure/spend, but a side-by-side
  manual comparison hasn't been recorded yet.
- `CRON_SECRET` isn't set in Vercel yet, so the daily scheduled sync (`vercel.json` → `/api/cron/sync`) won't
  authenticate until it is — manual "Sync now" is fully functional in the meantime.

✅ Sprint 3 (Campaign Monitoring & Detail, Epic A) complete and confirmed working against the real 922-campaign
dataset — sortable/searchable campaign table with health indicators, bulk property/manager tagging,
naming-convention auto-tagging, and a detail view with 30-day trend charts, DoD/WoW comparison, and a live
ad set/ad/creative breakdown. First unit test suite added (`vitest`) alongside a real bug fix — default sort now
ranks by spend instead of name, after a user-reported "every date range looks the same" turned out to be a UX
default-sort issue, not a filtering bug (root-caused via direct DB query before fixing).

✅ Sprint 4 (Lead Analytics, Epic B + Property Analytics, Epic C) complete — Property leaderboard with
side-by-side comparison and editable ROI assumptions (assumed conversion rate × avg deal value), a shared
`<EstimatedValue>` component enforcing the "Estimated" label + assumptions-on-hover everywhere ROI appears
(Section 28 acceptance criterion), a Lead Analytics page (top campaigns by leads, individual-lead table with
quality tagging), and the landing-page/CRM webhook (`/api/leads/webhook`) — the second required lead-ingestion
path per Section 5.1. Meta's native Lead Ads individual-record retrieval needs the restricted `leads_retrieval`
permission (Meta App Review) — documented as an external dependency rather than built speculatively; aggregate
lead counts (already reliable) cover the volume/CPL asks in the meantime.

✅ Sprint 5 (Budget Tracking & Pacing, Epic D + Alerts & Notifications, Epic E) complete — Campaign Detail now
shows lifetime/daily budget, utilization %, linear days-to-exhaustion forecast, and a pacing badge (ahead/on
track/behind, from recent spend velocity). An alert rule engine evaluates 8 of the 12 PRD Section 17 rules on
every sync (CTR below threshold, CPL increase, budget exhausted, campaign stopped unexpectedly, frequency high,
spend anomaly, lead volume dropped, campaign rejected, plus sync/API failure) with per-workspace configurable
thresholds, and an Alerts Centre (`/dashboard/alerts`) supports Acknowledge/Resolve/Escalate. **Deliberately not
built:** Learning Limited (needs daily ad-set-level sync, not just the on-demand detail-view fetch — meaningful
added API load), Estimated ROAS dropped WoW (needs a stored daily ROI history, not just the live Property
Analytics computation), and Pixel inactive (needs pixel event ingestion, not built at all yet) — see
`lib/alerts/rules.ts`'s file-level note. Alert delivery is in-app only; Email/WhatsApp dispatch is deferred to
whenever those channels are actually wired up (Sprint 9-ish), same posture as the WhatsApp/SMTP dependencies
already tracked.

**Confirmed against real production data:** after a fresh sync, Budget & Pacing showed sane figures (₹1,500 daily
budget, 70% utilization, correctly computed "Behind pace") and the Alerts Centre correctly caught two real
Active→Paused transitions as "Campaign stopped unexpectedly" — the minor-to-major currency conversion and the
rule engine are both working as intended, not just passing unit tests.

✅ Sprint 6-7 (Dashboards, Epic F) complete — role-aware `/dashboard` landing page dispatches based on the signed-in
user's RBAC role: **CEO** (Est. Revenue/ROI, top/bottom 3 properties, 30-day trend, no campaign drill-down),
**Management/Director** (property/city leaderboards, spend & leads trend, alert panel), and **Analyst** (full
sortable KPI table — a drag-drop pivot builder is explicitly Phase 2, Section 24). Administrator falls back to
the Director view (no dedicated Admin data-dashboard in Section 11; small teams often hold both roles per
Section 5.1). A new `workspace_daily_trend` RPC feeds the 30-day trend line without collapsing dates the way the
Sprint 3 aggregation RPC does.

📝 **Manager/Executive tracking was removed from the app entirely** shortly after Sprint 6-7, at the business's
explicit request — at the time this deviated from the then-current PRD. **The PRD was subsequently updated to
v4.0**, which formalizes that decision (Supervisor/Campaign Executive personas dropped for good, flat org model)
while restoring a full-workspace-scope **Marketing Manager** role (no per-person campaign attribution) — see
below. What was a deviation is now the documented spec; see `docs/DEVELOPMENT_PLAN.md`'s Deviation Log for the
full history.

✅ **PRD v4.0 alignment** complete — the PRD was substantially revised (personas reduced to 5, no
naming-convention auto-parsing, City becomes an independent bulk-taggable tag, and a new MVP module: the
**Campaign Profitability & Continue/Pause Advisor**, Section 9.10). Changes made:
- **Naming-convention auto-parsing removed entirely** (`lib/campaigns/naming.ts` deleted) — PRD v4 Section 5.1
  explicitly forbids it: "the system will not attempt to auto-parse campaign names... tagging is manual, in-app."
  Property and City are now two independent bulk-taggable fields (Section 9.2), not one derived from the other.
- **Marketing Manager role restored** (`supabase/migrations/0008_prd_v4_alignment.sql`) with full-workspace
  scope (RBAC matrix Section 21) — a new Manager Dashboard (Section 11.3) shows workspace-wide spend/leads/CPL,
  campaigns needing attention, and Profitability/Pause recommendations.
- **Campaign Profitability & Continue/Pause Advisor built** (Section 9.10) — a deterministic, rule-based
  (no AI/LLM call, per Section 23's explicit direction) per-campaign classification (Profitable / Break-even /
  Loss-making) and recommendation (Continue / Monitor / Reduce Budget / Pause), each with a templated,
  numbers-traceable reason. Runs as part of every sync (`lib/profitability/evaluate.ts`), surfaced on the
  Campaign Monitoring table, Campaign Detail page, all three business dashboards, a new dedicated
  `/dashboard/profitability` view, and a new `pause_recommended` alert rule. Thresholds (break-even margin,
  consecutive-day window, minimum spend for eligibility) are workspace-configurable by Administrators.

See [`docs/DEVELOPMENT_PLAN.md`](docs/DEVELOPMENT_PLAN.md) for the full build plan.

## Documents

| Document | Purpose |
|---|---|
| [`docs/prd-source/`](docs/prd-source/) | PRD source — v1.0 (2026-07-28) and v4.0 (current), see below |
| [`docs/DEVELOPMENT_PLAN.md`](docs/DEVELOPMENT_PLAN.md) | End-to-end build plan: phases, sprints, epics, acceptance gates |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Technical architecture, stack, API surface, integration design |
| [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) | Database schema (DDL), RLS policy design, indexing/partitioning strategy |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Sprint-by-sprint roadmap with dates, deliverables, and dependencies |

`docs/prd-source/` holds both `...v1.0.pdf` (original) and `...v4.0.pdf` (current, supersedes v1.0) — kept
side by side rather than overwritten, so the Deviation Log's "what changed and when" stays checkable against the
actual source documents.

## Quick facts

- **Scope at launch:** 1 Business Manager, multiple Ad Accounts, 300+ active campaigns, real estate vertical only.
- **Architecture:** Multi-tenant (workspace-based) from day one, so it can be white-labelled later.
- **Stack:** Next.js (App Router, latest stable — 16.x at scaffold time) + TypeScript + Tailwind, Supabase
  (Postgres + Auth + Realtime) with Row-Level Security, hosted on Vercel.
- **Phasing:** MVP (core tracking, lead analytics, role dashboards, alerts) → Phase 2 (Audience/Creative Analytics,
  AI-assisted scoring, custom report builder) → Phase 3 (multi-BM white-label, billing, other ad platforms).

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
```

The app runs standalone without any environment variables — the auth `proxy.ts` no-ops until Supabase is
configured. To connect Supabase (needed starting Sprint 1):

```bash
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from
# your Supabase project's Settings → API page
```

Useful scripts:

| Command | Purpose |
|---|---|
| `npm run dev` | Local dev server |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type-check |
| `npm run build` | Production build |

`supabase/migrations/00000000000000_workspace_rls_template.sql` contains the reusable workspace-scoped
Row-Level Security pattern (Sprint 1 builds the full schema in `docs/DATA_MODEL.md` on top of it) — already
applied to the live Supabase project.

`GET /api/health` reports whether Supabase is configured and reachable (no secrets in the response) — useful for
uptime checks per the NFR in `docs/ARCHITECTURE.md` §7.

`supabase/migrations/0001_core_schema.sql` is the full Sprint 1 schema: all entities from `docs/DATA_MODEL.md`,
workspace-scoped RLS on every table, and the role/permission model seeded from the PRD Section 21 RBAC matrix.

`supabase/migrations/0002_meta_sync_infrastructure.sql` adds Meta sync infrastructure: Supabase Vault-backed
token storage, `sync_log`, sync status columns on `ad_account`, and the unique constraints idempotent upserts
need.

`supabase/migrations/0003_campaign_monitoring.sql` adds `campaign_metrics_summary`, the per-range aggregation RPC
behind Campaign Monitoring, Property Analytics, and Lead Analytics.

`supabase/migrations/0004_lead_webhook.sql` adds `workspace.webhook_secret`, used to authenticate the landing-page/
CRM lead webhook (external systems can't hold a session cookie).

`supabase/migrations/0005_budget_pacing_alerts.sql` adds campaign budget columns (`daily_budget`,
`lifetime_budget`, `budget_remaining`, `effective_status`), `alert.acknowledged_at`/`acknowledged_by`, and
`workspace.alert_thresholds` (per-workspace configurable alert thresholds, Section 9.11).

`supabase/migrations/0006_dashboard_trend.sql` adds `workspace_daily_trend`, the per-day (not per-campaign)
aggregation RPC behind the dashboards' 30-day spend/leads trend line.

`supabase/migrations/0007_remove_manager_executive.sql` drops `campaign.manager_id`/`executive_id`, the
`sales_team_employee` table, and all three Manager/Supervisor/Executive RBAC roles — a deviation from the PRD at
the time, later formalized (partially) by PRD v4.

`supabase/migrations/0008_prd_v4_alignment.sql` restores the Marketing Manager role (full-workspace scope, not
per-person), adds `campaign.city` as an independent tag, and adds the Profitability Advisor's
`profitability_snapshot` table + `workspace.profitability_thresholds`.

Verification scripts:

| Script | Checks | Needs |
|---|---|---|
| `scripts/verify-rls.mjs` | Sprint 0 — basic workspace RLS isolation | anon key only |
| `scripts/verify-sprint1-schema.mjs` | Role/permission seeding, RLS on every core table | anon key only |
| `scripts/verify-sprint1-e2e.mjs` | Real sign-up → workspace creation → cross-user isolation | anon key, email rate limit headroom |
| `scripts/verify-sprint2-pilot.mjs` | Pulls synced campaign metrics for manual Ads Manager reconciliation | service_role key |
| `scripts/verify-sprint4-schema.mjs` | Confirms `workspace.webhook_secret` migrated correctly | service_role key |

Run `npm test` for the unit test suite (vitest) — pure business logic like the health heuristic, budget pacing
math, date-range math, ROI calculations, and the Profitability Advisor's classification/recommendation rules.
