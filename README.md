# Meta Ads Campaign Performance Tracker

Internal multi-tenant reporting & intelligence platform for Meta (Facebook) Ads — built for real estate marketing
operations, architected for white-label expansion.

This is a **read-only monitoring, analysis, and reporting layer** over Meta Ads Manager. It does not create, edit,
launch, or pause live ad campaigns.

## Status

✅ Sprint 0 (Foundation) complete — Next.js app is live on Vercel (https://metaadstracker.vercel.app), connected to
a provisioned Supabase project, with Row-Level Security verified end-to-end (anon reads return `[]`, anon writes
are rejected with a policy violation — see `scripts/verify-rls.mjs`). The full application schema (Section 18/19)
is not applied yet — that's Sprint 1. See [`docs/DEVELOPMENT_PLAN.md`](docs/DEVELOPMENT_PLAN.md) for the full
build plan.

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
uptime checks per the NFR in `docs/ARCHITECTURE.md` §7. `scripts/verify-rls.mjs` is a one-off script that exercises
RLS against the live project using only the public anon key.
