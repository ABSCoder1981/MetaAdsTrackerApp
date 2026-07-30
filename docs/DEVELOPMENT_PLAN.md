# Development Plan — Meta Ads Campaign Performance Tracker

Source: `docs/prd-source/Meta-Ads-Campaign-Performance-Tracker-PRD-v1.0.pdf` (v1.0, 2026-07-28)
This plan translates the PRD's 29 sections into a buildable, sequenced engineering plan.

---

## 1. Build Philosophy

Three principles drive sequencing, taken directly from the PRD's own constraints:

1. **Data foundation before UI.** Meta API Integration, the multi-tenant schema, and RLS (Sections 18–19, 23) are
   built first — every dashboard, report, and alert depends on them, and retrofitting workspace isolation later is
   explicitly called out as a risk (Section 26).
2. **MVP is a hard boundary, not a suggestion.** Section 24's phase gating is enforced at the sprint-planning level:
   Audience Analytics, Creative Analytics, AI recommendations, and the custom report builder do not get scoped into
   any MVP sprint, even opportunistically.
3. **Pilot before scale.** Section 25's rollout plan (one Ad Account first, validate against Ads Manager's own
   numbers, then onboard the rest) is treated as a required gate before Stage 2, not an optional nicety.

---

## 2. Phase Overview

| Phase | Theme | Target Duration | Exit Criteria |
|---|---|---|---|
| **Phase 0 — Foundation** | Repo, infra, schema, auth, Meta sync pipeline | 2–3 sprints (4–6 wks) | One Ad Account syncing daily; RLS verified; CI/CD live |
| **Phase 1 — MVP** | Sections 9.1–9.5, 9.8–9.16 (all MVP-tagged modules) | 6–8 sprints (12–16 wks) | All 8 acceptance criteria in PRD Section 28 pass |
| **Phase 2** | Audience/Creative Analytics, AI-assisted lead scoring, custom report builder, deeper CRM/ROI | 4–5 sprints | Per Section 24 scope table |
| **Phase 3** | Multi-Business-Manager white-label, billing layer, other ad platforms, native mobile | Post-first-client | Triggered by first white-label deal, not calendar |

Sprint length assumed: **2 weeks**. Team size assumed per PRD Section 5.1 (small team, 1–2 engineers) — adjust
sprint count proportionally if headcount differs.

---

## 3. Phase 0 — Foundation (Sprints 0–2)

Nothing in Phase 1 can start meaningfully until this phase's exit criteria are met, because every MVP module reads
from the schema and sync pipeline built here.

### Sprint 0 — Scaffold & Infra
- Initialize Next.js (App Router, latest stable — 16.x) + TypeScript + Tailwind project; PWA manifest/service worker stubbed (NFR:
  offline support, Section 10).
- Provision Supabase project; enable Auth, Realtime, Row-Level Security.
- Set up GitHub Actions → Vercel preview/production pipeline (Section 23).
- Define `workspace_id`-scoped RLS pattern as a reusable Postgres policy template (Section 19).
- Repo hygiene: lint/format config, PR template, branch protection on `main`.

### Sprint 1 — Core Schema & Auth
- Implement core entities from Section 18.1: `workspace`, `business_manager`, `ad_account`, `campaign`, `ad_set`,
  `ad`, `creative`, `audience`, `pixel`, `property`, `sales_team_employee`, `role`, `permission`, `user`.
- Implement `daily_metrics` fact table with the `(workspace_id, campaign_id, date)` composite index called out in
  Section 19 as the hot query path.
- Supabase Auth wired to workspace-scoped sessions; workspace switcher UI shell (Section 9.16).
- RBAC matrix (Section 21) encoded as Postgres roles/policies, not just application middleware — this is what makes
  the Section 28 acceptance test ("blocked even via direct API call") possible.

### Sprint 2 — Meta API Integration & Sync Pipeline
- System User-based auth per workspace (Section 9.14) — dedicated Business Manager System User, Employee-level
  access, credentials encrypted at rest (NFR: Security, Section 10).
- Vercel Cron scheduled daily sync + on-demand manual refresh endpoint.
- Retry-with-backoff for rate limits/token expiry; sync status (last-synced timestamp, error state) surfaced to a
  minimal Admin view.
- Pilot: connect **one** Ad Account, validate synced numbers against Ads Manager's own reported figures
  (Rollout Stage 1, Section 25) before Phase 1 work begins.
- **Gate:** sync accuracy within the agreed tolerance (±2%, Section 28) on the pilot account, or Phase 1 does not
  start.

---

## 4. Phase 1 — MVP (Sprints 3–10)

Grouped into epics that map directly to PRD Section 9's MVP-tagged modules. Each epic lists its PRD source
section(s) and its own Definition of Done.

### Epic A — Campaign Monitoring & Detail (Sections 9.2, 9.3) — Sprint 3
- Sortable/filterable campaign table: name, account, status, objective, spend, results, CPL/CPA, delivery/learning
  status.
- Green/Amber/Red health indicator computed from CTR, frequency, pacing thresholds (thresholds configurable per
  workspace, per Section 17).
- Bulk tagging UI for property/city/manager/executive; naming-convention auto-parse
  (`[Manager] - [Client/Property] [Objective] Campaign [Month-Year]`) with manual fallback (Section 5.1).
- Campaign detail view: time-series trend chart, ad set/ad breakdown table, creative thumbnails, DoD/WoW toggle.
- **DoD:** a manager can find any of their campaigns, see its health, and retag it without leaving the table.

### Epic B — Lead Analytics (Section 9.4) — Sprint 4
- Dual ingestion: Meta Lead Ads API pull + landing-page/CRM webhook endpoint (Section 5.1 — both paths required).
- Unified lead table merging both sources; CPL computed per campaign/property/city/manager.
- Lead volume trend by campaign/property/city/source.
- Manual lead-quality tag field (Phase 2 upgrades this to auto-scored — do not build scoring model now).
- **DoD:** "which campaign generated maximum leads" answerable from one screen, using either lead source.

### Epic C — Property Analytics (Section 9.5) — Sprint 4 (parallel with B)
- Property-level rollup: spend, leads, CPL, Estimated ROI.
- Side-by-side comparison (up to 5 properties); sortable leaderboard.
- Estimated ROI computed from editable assumed-conversion-rate + avg-deal-value inputs, **always** labeled
  "Estimated" with the assumption visible on hover (Section 28 acceptance criterion — do not skip the label).

### Epic D — Budget Tracking & Pacing (Section 9.8) — Sprint 5
- Budget utilization % and ahead/on-track/behind pacing indicator per campaign/account.
- Linear-projection forecast spend; remaining budget + days-until-exhaustion estimate.
- Feeds the Budget Exhausted alert rule (Section 17) — build alert rule engine dependency-aware of this epic.

### Epic E — Alerts & Notifications (Sections 9.11, 17) — Sprint 5–6
- Configurable rule engine, per-workspace thresholds, covering all 12 rules in Section 17 (CTR drop, CPL increase,
  budget exhausted, campaign rejected, campaign stopped unexpectedly, Learning Limited, frequency high, Estimated
  ROAS dropped, spend anomaly, lead volume dropped, pixel inactive, sync/API failure).
- Acknowledge/Resolve/Escalate workflow with audit trail (feeds Epic K).
- Delivery: Email + in-app (PWA push via Supabase Realtime) at MVP launch. **WhatsApp Business API is scoped but
  not launch-blocking** — Section 26 risk mitigation explicitly says ship Email + in-app first, add WhatsApp once
  templates are Meta-approved (this has external lead time, track it as a parallel workstream starting Sprint 0 —
  see Section 8 of this plan).
- **DoD:** all 12 rules fire correctly against seeded test data (Section 28 acceptance criterion).

### Epic F — Dashboards (Section 9.1, 11) — Sprint 6–7
- Role-aware landing page shell + 5 dashboard templates: CEO, Management/Director, Manager, Supervisor
  (shared template with Executive, scope-filtered), Analyst.
- Today-vs-Yesterday delta on headline KPIs; Top 3 alerts pinned; quick filters (date, account, property, manager).
- Each dashboard's specific widget set per Section 11.1–11.6 — build widget components once, compose differently
  per role rather than duplicating layout code.
- **DoD:** every persona's dashboard loads with role-correct data scope, verified against the RBAC matrix — no
  cross-scope data leakage (Section 28 acceptance criterion, tested via direct API calls, not just UI).

### Epic G — Reports (Sections 9.9, 15) — Sprint 7
- Auto-generated Daily Digest (9 AM IST), Weekly Performance Report (Monday), Monthly Executive Summary (1st
  business day), Manager Performance Report, Property Performance Report, on-demand Campaign Performance Report.
- Delivery via Email + in-app (WhatsApp once approved, non-blocking per Epic E note).
- **Do not build:** Creative/Audience Performance Reports, Lead Quality/Sales Funnel Report, or the custom report
  builder — all explicitly Phase 2 (Section 15).

### Epic H — Team & Employee Performance (Section 9.10) — Sprint 8
- Manager and Executive leaderboards: CPL, lead volume, alert response time.
- Individual performance trend view for 1:1 coaching use.
- Respects RBAC constraint: managers cannot see other managers' compensation-linked KPIs unless Director-level
  (Section 7.3).

### Epic I — Export Centre (Section 9.12) — Sprint 8 (parallel with H)
- CSV/XLSX export for any filtered table view.
- Branded PDF export for report views (workspace-logo aware — this is where white-label theming variables from
  Section 22 first get exercised).
- Export history/audit log (feeds Epic K).

### Epic J — Admin & Role Management, Workspace Settings (Sections 9.13, 9.16) — Sprint 9
- User invite/deactivate flow; role assignment per RBAC matrix.
- Workspace settings: branding, timezone, currency, alert thresholds, notification channel preferences.
- Workspace switcher for multi-workspace users.
- Connect/reconnect Ad Account flow.
- **DoD:** an Admin can invite a user, assign a role, and connect a new Ad Account without engineering help
  (Section 28 acceptance criterion — literally test this with a non-engineer if possible).

### Epic K — Audit Logs (Section 9.15) — Sprint 9 (parallel with J)
- Immutable log of logins, exports, settings changes, alert acknowledgments, role changes.
- Admin-only searchable view with date/user/action filters.

### Sprint 10 — MVP Hardening & Acceptance
- Run every checklist item in PRD Section 28 as a formal test pass, not an informal review.
- Load/perf pass against NFRs (Section 10): dashboard <2s cached load, filtered queries <3s at 300+ campaign scale.
- Accessibility pass: WCAG 2.1 AA contrast, keyboard-navigable tables.
- Security pass: confirm RLS blocks cross-workspace access via direct API call (not just hidden in UI).
- **Phase 1 exit gate:** all Section 28 acceptance criteria pass before Rollout Stage 2 (Section 25) begins.

---

## 5. Phase 2 (Post-MVP)

Only start after Phase 1's exit gate. Scope per Section 24:

| Epic | PRD Section | Notes |
|---|---|---|
| Audience Analytics | 9.6 | Age/gender/placement/device breakdown, overlap/fatigue indicator, best-audience recommendation |
| Creative Analytics | 9.7 | Creative-level table with thumbnails, fatigue alert (frequency↑ + CTR↓), leaderboard |
| Lead Quality Scoring (modeled) | 13.4 | Upgrades Epic B's manual tag to a historical-pattern model |
| Custom/Scheduled Report Builder | 9.9, 15 | Quarterly/Yearly + fully custom date-range reports |
| Seasonality-aware forecasting | 9.8 | Upgrades Epic D's linear projection |
| Deeper CRM integration | Problem Statement, 13.4 | Moves ROI from "Estimated" toward confirmed, where CRM data allows |

---

## 6. Phase 3 (Future — Trigger-Based, Not Calendar-Based)

Per Section 24/25 Stage 5: **do not pre-build this.** Start only when the first white-label client is signed, and
use that onboarding itself as the end-to-end test of the multi-tenant model:

- Multi-Business-Manager support (one workspace, multiple BMs).
- Commercial billing layer (explicitly out of scope for this PRD — separate workstream, Section 6).
- Additional ad platforms (Google Ads, LinkedIn Ads) — architecture must not preclude this, per Section 6, but it's
  not scoped work until a client asks.
- Native mobile apps.

---

## 7. Cross-Cutting Workstreams (Run in Parallel, Not as Sprint Line Items)

These don't belong to one sprint — they're tracked continuously across Phase 0–1:

- **WhatsApp Business Account approval** — has external lead time (Meta template pre-approval). Kick off the
  application in Sprint 0 so it's ready by the time Epic E/G need it. Non-blocking for MVP launch either way.
- **Data-quality / tagging completeness** — the naming-convention parser (Epic A) will not catch 100% of campaigns.
  Track a completeness % on the dashboard from Sprint 3 onward rather than discovering the gap at UAT.
- **Meta API contract drift** — pin API version explicitly in the sync client (Epic in Sprint 2); revisit pinned
  version each quarter, don't auto-upgrade.
- **"Estimated" labeling discipline** — every ROI/ROAS surface (dashboards, reports, exports) must carry the label
  and hoverable assumptions panel. Treat this as a shared component (`<EstimatedValue>`), not a per-screen
  reimplementation, to avoid one screen silently dropping the label.

---

## 8. Rollout Sequencing (ties Section 25 to the sprint plan above)

| Stage | Corresponds to | Gate before proceeding |
|---|---|---|
| 1. Pilot one Ad Account | End of Sprint 2 | Sync accuracy ±2% vs. Ads Manager |
| 2. Onboard remaining Ad Accounts, run in parallel with manual reporting | After Sprint 10 (MVP exit) | One full week of parallel run, numbers trusted |
| 3. Switch reporting fully to system, retire manual reports | Post-Stage 2 | Stakeholder sign-off |
| 4. Roll out dashboards to Managers/Supervisors/Executives | Post-Stage 3 | Short walkthrough only — no formal training module needed at this team size |
| 5. First white-label client onboarding | Triggers Phase 3 | Contract signed |

---

## 9. Risk Tracking (carried from Section 26, owner assigned at kickoff)

| Risk | Sprint(s) it must be addressed in | Mitigation owner |
|---|---|---|
| Meta API rate limits / breaking changes | Sprint 2, ongoing | Backend eng — backoff/retry, version pin |
| "Estimated ROI" mistaken for confirmed revenue | Sprint 4 (Epic C) | Frontend eng — shared `<EstimatedValue>` component |
| Untagged/inconsistent campaign names | Sprint 3 (Epic A) | Product — completeness indicator, not just parser |
| WhatsApp approval delay | Sprint 0 kickoff, ongoing | Admin/founder — submit application immediately |
| Multi-tenant data leakage | Sprint 1 (schema), Sprint 10 (hardening) | Backend eng — RLS at DB layer, verified via direct API test |
| Scope creep back to full 25-section spec | Every sprint planning session | Whoever runs sprint planning — enforce Section 24 gate explicitly |

---

## 10. Acceptance Criteria Traceability

Every bullet in PRD Section 28 must be traceable to the epic that satisfies it before Phase 1 is declared done:

| Section 28 Criterion | Satisfied by |
|---|---|
| 300+ campaigns sync daily, visible timestamp, Admin alert on failure <15min | Sprint 2 (Meta sync), Epic E (alerts) |
| Every dashboard loads with role-correct scope per RBAC | Epic F, Sprint 1 RBAC/RLS |
| Daily Digest delivered automatically (Email + in-app) | Epic G |
| CPL/spend/leads reconcile with Ads Manager within ±2% | Sprint 2 pilot gate |
| Estimated ROI always labeled, assumptions visible on hover | Epic C, cross-cutting labeling discipline (Section 7) |
| Admin can invite user/assign role/connect Ad Account without engineering | Epic J |
| All 12 alert rules fire correctly, can be ack/resolved | Epic E |
| RLS blocks cross-workspace access via direct API call | Sprint 1, verified in Sprint 10 hardening |
