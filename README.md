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

See [`docs/DEVELOPMENT_PLAN.md`](docs/DEVELOPMENT_PLAN.md) for the full build plan.

## Documents

| Document | Purpose |
|---|---|
| [`docs/prd-source/`](docs/prd-source/) | Original PRD (v1.0, 2026-07-28), source of truth for requirements |
| [`docs/DEVELOPMENT_PLAN.md`](docs/DEVELOPMENT_PLAN.md) | End-to-end build plan: phases, sprints, epics, acceptance gates |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Technical architecture, stack, API surface, integration design |
| [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) | Database schema (DDL), RLS policy design, indexing/partitioning strategy |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Sprint-by-sprint roadmap with dates, deliverables, and dependencies |

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

Verification scripts:

| Script | Checks | Needs |
|---|---|---|
| `scripts/verify-rls.mjs` | Sprint 0 — basic workspace RLS isolation | anon key only |
| `scripts/verify-sprint1-schema.mjs` | Role/permission seeding, RLS on every core table | anon key only |
| `scripts/verify-sprint1-e2e.mjs` | Real sign-up → workspace creation → cross-user isolation | anon key, email rate limit headroom |
| `scripts/verify-sprint2-pilot.mjs` | Pulls synced campaign metrics for manual Ads Manager reconciliation | service_role key |
