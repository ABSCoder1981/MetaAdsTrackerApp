# Meta Ads Campaign Performance Tracker

Internal multi-tenant reporting & intelligence platform for Meta (Facebook) Ads — built for real estate marketing
operations, architected for white-label expansion.

This is a **read-only monitoring, analysis, and reporting layer** over Meta Ads Manager. It does not create, edit,
launch, or pause live ad campaigns.

## Status

📋 Planning phase — MVP build not yet started. See [`docs/DEVELOPMENT_PLAN.md`](docs/DEVELOPMENT_PLAN.md) for the
full build plan.

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
- **Stack:** Next.js 14 (App Router) + TypeScript + Tailwind, Supabase (Postgres + Auth + Realtime) with
  Row-Level Security, hosted on Vercel.
- **Phasing:** MVP (core tracking, lead analytics, role dashboards, alerts) → Phase 2 (Audience/Creative Analytics,
  AI-assisted scoring, custom report builder) → Phase 3 (multi-BM white-label, billing, other ad platforms).

## Getting started (once build begins)

Setup instructions will be added here once the project scaffold (Next.js + Supabase) is initialized in
Sprint 0 — see `docs/ROADMAP.md`.
