# Technical Architecture

Elaborates PRD Section 23 (Technical Architecture), Section 20 (API Design), and Section 19 (Database Design) into
concrete implementation decisions. This is the reference engineers should build against during Phase 0–1.

## 1. Stack Summary

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS | PWA-enabled from Sprint 0, not bolted on later |
| Backend | Next.js API routes / server actions (modular monolith) | No microservices at this scale (300+ campaigns, 10–25 users) |
| Database | Supabase (managed Postgres) | Row-Level Security enforced per `workspace_id` on every table |
| Auth | Supabase Auth | Workspace-scoped sessions, workspace switcher for multi-workspace users |
| Meta API Integration | System User per workspace, Vercel Cron scheduler | Never a personal Facebook login — survives staff turnover |
| Background jobs / queue | Vercel Cron (sync) + Supabase Edge Functions (alert evaluation, notification dispatch) | Decoupled from user-facing request cycles |
| Notifications | Resend/SendGrid (email), WhatsApp Business Cloud API (pre-approved templates), Supabase Realtime (in-app) | WhatsApp is additive post-approval, not launch-blocking |
| Hosting | Vercel | Zero-config previews per PR |
| CI/CD | GitHub Actions → Vercel preview → production on merge to `main` | Branch protection required on `main` |

## 2. Multi-Tenancy Model

- `workspace` is the tenancy boundary. Every child table carries an explicit `workspace_id` FK — even where it's
  derivable via a join — because this is what makes RLS policies simple, fast, and auditable.
- RLS policy pattern (applied to every workspace-scoped table):

```sql
alter table <table_name> enable row level security;

create policy "workspace_isolation_select" on <table_name>
  for select using (
    workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );

-- Mirror equivalent policies for insert/update/delete, scoped by role permissions,
-- not just workspace membership.
```

- Bootstrapping (initial workspace/user creation) uses a `SECURITY DEFINER` function so RLS doesn't block the
  chicken-and-egg problem of a brand-new workspace with no members yet.
- **Verification requirement:** RLS isolation must be tested via direct `curl`/API calls with a valid session token
  from Workspace A attempting to read Workspace B's data — not just verified by "the UI doesn't show it."

## 3. API Surface

All routes scoped under `/api/workspaces/{workspaceId}/...` so the tenancy boundary is explicit at the URL level,
per PRD Section 20.

| Domain | Endpoints |
|---|---|
| Dashboard | `GET /dashboard/summary`, `GET /dashboard/alerts` |
| Campaign | `GET /campaigns`, `GET /campaigns/{id}`, `PATCH /campaigns/{id}/tags` |
| Metrics | `GET /metrics/daily`, `GET /metrics/compare` |
| Leads | `GET /leads`, `POST /leads/webhook` (CRM/landing-page ingestion) |
| Reports | `GET /reports`, `GET /reports/{id}`, `POST /reports/generate` |
| Filters | `GET /filters/options` |
| Export | `POST /export`, `GET /export/history` |
| Auth | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` |
| Notification | `GET /notifications`, `PATCH /notifications/{id}/read` |
| Alert | `GET /alerts`, `PATCH /alerts/{id}/acknowledge`, `PATCH /alerts/{id}/resolve` |
| Settings | `GET/PATCH /workspace/settings`, `GET/POST /workspace/users`, `GET/POST /workspace/ad-accounts` |
| Meta Sync (internal, cron-triggered) | `POST /internal/sync/{workspaceId}` |

All mutating endpoints write to `audit_log` (Section 9.15) — this should be a shared middleware/wrapper, not
per-route boilerplate, to guarantee nothing is missed.

## 4. Meta Marketing API Integration

- **Auth model:** one Business Manager System User per workspace, Employee-level access token, encrypted at rest
  (e.g. Supabase Vault or equivalent secret store — never in plaintext columns).
- **Sync cadence:** daily scheduled sync via Vercel Cron, plus an on-demand manual refresh button surfaced to Admins.
- **Two lead ingestion paths** (PRD Section 5.1 — both required, not optional):
  1. Meta Lead Ads API pull (native lead forms).
  2. Pixel/CRM webhook receiver (`POST /leads/webhook`) for landing-page-sourced leads.
- **Resilience:** exponential backoff + retry on rate limits and transient failures; token-expiry detection triggers
  an Admin-only "Sync/API failure" alert (Section 17) rather than failing silently.
- **API version pinning:** pin the Marketing API version explicitly in the sync client config; bump deliberately on
  a quarterly review, not automatically.

## 5. Caching & Performance Strategy

- Daily rollup tables are pre-computed by the sync job — dashboards never compute aggregates live at request time.
  This is the mechanism behind the <2s cached / <3s filtered NFR targets (Section 10).
- Next.js data caching (route-level `revalidate` / tag-based invalidation) layered on top of the DB-level rollups.
- PWA offline mode: last-synced dashboard data cached client-side, with an explicit "stale data" indicator when the
  client is offline or the cache is beyond the sync interval.

## 6. Alerts Architecture

- Rule engine evaluates the 12 rules in PRD Section 17 against freshly-synced `daily_metrics` rows immediately after
  each sync job completes (not on a separate polling schedule — avoids double-latency).
- Each rule produces an `alert` row (workspace-scoped); `notification` rows fan out per recipient per channel.
- Acknowledge/Resolve/Escalate transitions are audit-logged and drive the Supervisor/Manager dashboards' "alert
  response time" KPI (Section 9.10).
- Thresholds are workspace-configurable (stored in `workspace.alert_thresholds` jsonb or a dedicated
  `alert_rule_config` table) — never hardcoded per PRD Section 9.11.

## 7. Security & Compliance Notes

- Encrypted secrets for all Meta API tokens (Supabase Vault or KMS-backed secret storage).
- User-facing errors are plain-language; stack traces/technical detail go to server logs only (NFR, Section 10).
- Sync job failures and API error rates are tracked and visible to Admins — silent failure is treated as a
  production incident, not an edge case.
- WCAG 2.1 AA color contrast on all charts/KPI cards; keyboard-navigable tables — build this into the shared
  component library from the first component, not retrofitted at QA.

## 8. What This Architecture Deliberately Avoids (and why)

- **No microservices** — team size and campaign volume (300+, scaling to 3,000+) don't justify the operational
  overhead; a modular monolith with clear domain boundaries in the codebase is sufficient and faster to build.
- **No live campaign write access to Meta** — this is a read-only reporting layer by explicit PRD non-goal
  (Section 6); no code path should ever call a Meta Ads Manager mutation endpoint.
- **No bespoke queue infrastructure** — Vercel Cron + Supabase Edge Functions cover the sync/alert-dispatch need at
  this scale; don't stand up Kafka/SQS/etc. until Phase 3 volume actually demands it.
