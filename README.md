# Meta Ads Campaign Performance Tracker

Internal multi-tenant reporting & intelligence platform for Meta (Facebook) Ads — built for real estate marketing
operations, architected for white-label expansion.

This is a **read-only monitoring, analysis, and reporting layer** over Meta Ads Manager. It does not create, edit,
launch, or pause live ad campaigns.

## Status

✅ Sprint 0 (Foundation) complete — Next.js app live on Vercel, connected to a provisioned Supabase project, RLS
verified end-to-end.

✅ Sprint 1 (Core Schema & Auth) mostly complete — full schema applied (all entities in `docs/DATA_MODEL.md`),
RBAC role/permission model seeded from PRD Section 21, email/password sign-in + sign-up, workspace
creation/onboarding, and a protected dashboard shell with a workspace switcher. Verified at the anon level:
role templates seeded correctly, every workspace-scoped table returns `[]` to anon reads and rejects anon writes
with a policy violation (`scripts/verify-sprint1-schema.mjs`). **Pending:** the full authenticated round-trip test
(`scripts/verify-sprint1-e2e.mjs`) — currently blocked by Supabase's built-in 2-emails/hour rate limit on the
shared SMTP service, not by any app or schema issue; re-run once the quota window clears (or after custom SMTP
is configured, see Sprint 9).

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

Verification scripts (anon key only, no secrets required):

| Script | Checks |
|---|---|
| `scripts/verify-rls.mjs` | Sprint 0 — basic workspace RLS isolation |
| `scripts/verify-sprint1-schema.mjs` | Role/permission seeding, RLS on every core table |
| `scripts/verify-sprint1-e2e.mjs` | Real sign-up → workspace creation → cross-user isolation (needs email rate limit headroom) |
