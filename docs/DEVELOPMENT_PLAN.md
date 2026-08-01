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

### Epic H — Team & Employee Performance (Section 9.10 in PRD v1.0) — DROPPED, see Section 11 Deviation Log
Written against v1.0's Manager/Supervisor/Executive hierarchy (per-person leaderboards, 1:1 coaching views).
That hierarchy doesn't exist under PRD v4.0's flat org model (Section 5.1, formalized in Section 11 above) —
there's no per-manager or per-executive scope left to leaderboard. PRD v4.0 also reassigns Section 9.10 itself
to the Profitability Advisor (Section 12 above, already built). Sprint 8 proceeds with Export Centre only; if a
team-performance need resurfaces later it'll be scoped fresh against whatever the org model looks like then, not
resurrected from this v1.0 spec.

### Epic I — Export Centre (Section 9.12) — Sprint 8
- **Built:** CSV export for the Campaign Monitoring table and the Properties leaderboard, respecting whatever
  filter/sort/date-range is currently applied on screen (`components/ExportCsvButton.tsx`, `lib/export/csv.ts`).
- **Scoped down from the PRD's "CSV/XLSX":** true binary `.xlsx` needs a writer library; the only viable npm
  option at evaluation time (`xlsx`/SheetJS) carries two unpatched high-severity advisories (prototype pollution,
  ReDoS — `GHSA-4r6h-8v6p-xvw6`, `GHSA-5pgg-2g8v-p4x9`). Rather than ship a known-vulnerable dependency, CSV only
  was shipped — Excel/Sheets both open `.csv` natively, so the actual workflow (get filtered data into a
  spreadsheet) works today. Revisit with a vetted library (e.g. `exceljs`) if a real need for native `.xlsx`
  formatting (multiple sheets, styling) shows up.
- **Not built:** branded PDF export (depends on the Reports Centre, Epic G, which isn't built yet either) and
  export history/audit log (depends on Epic K, Sprint 9). Both deferred for the same reason Epic G's report
  delivery was deferred in Section 12 above — don't build half of a dependent feature ahead of its dependency.

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
- **Supabase's shared-SMTP email rate limit (2/hour)** — discovered during Sprint 1 auth testing; blocks anything
  that triggers auth emails (sign-up confirmations, password resets) beyond a couple of attempts per hour. Fine for
  now with email confirmation disabled in dev, but real user onboarding (Rollout Stage 1+) needs custom SMTP
  configured in Supabase Auth settings before launch — track this alongside the WhatsApp approval item above as a
  pre-launch dependency, not a Sprint 1 blocker.
- **Sprint 2 pilot accuracy reconciliation** — the pilot Ad Account synced successfully against real production
  data (922 campaigns, correct names/structure/spend on first run), but the formal side-by-side ±2% comparison
  against Ads Manager's own reported numbers (Section 28 acceptance criterion) hasn't been recorded yet. Required
  before Rollout Stage 2 (onboarding the remaining Ad Accounts), not before Sprint 2 is considered built.
- **`CRON_SECRET` not yet set in Vercel** — the daily scheduled sync (`vercel.json` → `/api/cron/sync`) will 401
  until this env var is added; manual "Sync now" via `/dashboard/ad-accounts` is unaffected and fully functional.
  Set before relying on unattended daily syncs.
- **Meta Lead Ads individual-record retrieval requires the `leads_retrieval` permission** — a restricted
  permission that needs Meta App Review, in the same category as the WhatsApp Business API approval above.
  Sprint 4 deliberately did not build speculative integration code for this (would be untestable without the
  permission). What's shipped instead: aggregate lead counts from Insights (`daily_metrics.leads`, already
  reliable and validated in Sprint 2/3) cover all of Section 9.4/13.4's volume and CPL asks; the landing-page/CRM
  webhook (`/api/leads/webhook`) covers the second required ingestion path per Section 5.1. Only
  individual-record drill-down/quality-tagging for Meta-native lead-form leads specifically is blocked — apply
  for `leads_retrieval` if that becomes a priority.

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

---

## 11. Deviation Log (business-decided divergences from the PRD)

Changes made at the business's explicit request that contradict what the PRD in force *at the time* specified —
kept here so anyone reading the PRD alongside the codebase later understands why they disagree, rather than
assuming a bug or an incomplete build. Entries are dated because the PRD itself has since moved (v1.0 → v4.0);
what was a deviation against v1.0 may since be the documented spec in v4.0 — each entry says so explicitly.

### Manager/Executive tracking removed entirely (Sprint 6-7, post-launch, against PRD v1.0) — later formalized by PRD v4.0

**What PRD v1.0 specified:** Manager, Supervisor, and Campaign Executive as three of the seven core personas
(Sections 7.3–7.5), with their own dashboards (Sections 11.3–11.5), Team & Employee Performance tracking and
leaderboards (Section 9.10), campaign tagging by manager/executive (Section 9.2), and corresponding RBAC roles
and permissions (Section 21).

**What was built instead:** none of it. `campaign.manager_id`/`executive_id` columns, the `sales_team_employee`
table, the three RBAC roles, their three dashboards, the Manager Leaderboard widget, and the "Add Team Member" /
manager-tagging UI were all built in Sprints 1, 3, and 6-7 — then removed in full once the business clarified
they don't track campaigns by manager/executive at all. This was confirmed twice explicitly before removal (see
conversation record) given how much it contradicted PRD v1.0's own stated requirements. The naming-convention
parser (`lib/campaigns/naming.ts`) was kept at this point, minus its manager-persistence step — it still located
the Property name via the "text before the first ` - `" heuristic.

**PRD v4.0 update (supersedes this entry):** the PRD itself was revised. Supervisor and Campaign Executive are
gone for good — v4.0 formally adopts a flat org model (Section 5.1: "one Manager/Director-level role sees the
full workspace rather than campaigns being scoped to individual people"), matching what was already built. But
**Marketing Manager comes back** as one of the 5 finalized personas (Section 7.3) — full-workspace scope, not
per-person — with its own role, dashboard (Section 11.3), and RBAC row (Section 21). Migration
`0008_prd_v4_alignment.sql` restores it. What was a full removal is now a partial restoration to match the
current spec, not a re-deviation.

### No campaign naming-convention auto-parsing (formalized by PRD v4.0, removed from the app)

**What changed:** PRD v4.0 Section 5.1 explicitly states "the system will not attempt to auto-parse campaign
names to extract property, city, or any other attribute — tagging is manual, in-app, done once per campaign by
whoever sets it up." This contradicts PRD v1.0's Section 5.1, which recommended a naming convention specifically
*to be* auto-parsed, and which Sprint 3 (Epic A) built support for.

**What was built, then removed:** `lib/campaigns/naming.ts` (a regex-based parser) and the "Auto-tag from
naming" button on Campaigns were built in Sprint 3, used successfully against real production data (confirmed
working — see Sprint 3/4 verification notes), then deleted entirely once PRD v4.0 made the "no auto-parsing"
decision explicit. Property and City are now two independent manually-bulk-tagged fields (Section 9.2) — City is
no longer even derived from Property, it's its own campaign-level column.

**Why this isn't a loss:** the naming-convention parser's real weakness — ambiguous multi-dash campaign names
(e.g. `Madhusmruti - Kothrud - Hemant Leads Campaign June-26`, where it's unclear whether "Kothrud - Hemant" is
one property name or two concepts) — is exactly what prompted the business to reconsider auto-parsing in the
first place. Manual tagging has no such ambiguity.

---

## 12. Campaign Profitability & Continue/Pause Advisor (PRD v4.0 Section 9.10 — new MVP module)

Not in PRD v1.0 at all; added in v4.0 as a full MVP-tagged module. Built as part of the same alignment pass that
removed naming auto-parse and restored Marketing Manager, rather than as its own numbered sprint — logged here
since it doesn't map to the original Sprint 3–10 plan.

**What it does:** for every Property-tagged campaign with ROI assumptions configured and enough total spend to
clear an eligibility floor, computes a deterministic (no AI/LLM call, per Section 23's explicit instruction)
classification — Profitable / Break-even / Loss-making — and a paired recommendation — Continue / Monitor /
Reduce Budget / Pause — with a plain-language, numbers-traceable reason (e.g. "Estimated Profit/Loss negative
for 8 consecutive days (threshold: 7). CPL 32% above break-even threshold."). Advisory only; nothing in the app
can pause a campaign in Meta (Section 6, Out of Scope, unchanged from v1.0).

**Where it runs:** `lib/profitability/evaluate.ts`, called once per ad account at the end of every sync
(`lib/meta/sync.ts`) — same batched-query pattern as the alert engine (Sprint 5), not one query per campaign.

**What it touches:**
- `profitability_snapshot` table — one row per campaign per evaluation run (Section 18.1's new entity), so
  "days below break-even" is a real consecutive-run counter, not a guess.
- `workspace.profitability_thresholds` — break-even margin %, consecutive-day threshold, minimum spend for
  eligibility, all Admin-configurable (Section 9.10's explicit requirement) via `/dashboard/profitability`.
- A new alert rule, `pause_recommended` (red, Section 17), deduped like every other rule in `lib/alerts/`.
- Surfaced on: Campaign Monitoring table (badge column), Campaign Detail page (dedicated section), CEO Dashboard
  (Profitable/Break-even/Loss-making counts), Management and Manager Dashboards (a recommendations panel), and
  its own `/dashboard/profitability` list view with the Admin-only threshold form (Section 12's screen spec).

**Deliberately not built:** the Reports Centre delivery of the "Profitability & Recommendation Report" (Section
15) — report generation/email delivery isn't built for any report yet (tracked as Epic G/Sprint 9-ish scope in
Section 4 of this plan), so this one report type isn't ahead of the others.

**Test coverage:** `lib/profitability/rules.ts` (16 tests) — classification boundaries, the consecutive-day
counter, all four recommendation branches, and that the reason text actually contains the numbers it claims to
(Section 28's "reproducible from its stated inputs" acceptance criterion).

---

## 13. Property Tagging UX Fixes (post-launch, discovered during hands-on testing against production data)

Not scope changes against the PRD — Epic C (Section 9.5) and Epic A's manual tagging (Section 9.2, per the v4.0
no-auto-parse decision, Section 11 above) were already built to spec. These are UX gaps found only once a real
user tagged real properties, logged here so the fixes aren't mistaken for new features later.

**Properties page only showed properties with a metrics rollup.** `/dashboard/properties` built its table from
`rollupByProperty(campaigns, metrics)`, which only emits a row for a property referenced by at least one
campaign with metrics in the selected date range. A freshly created property with zero campaigns tagged to it
yet — the normal state right after using "Add Property" — was invisible, with no error or empty-state hint.
Fixed by building the table from the full `property` list instead, left-joining rollup metrics (defaulting to
zero for untagged properties) and adding a Campaigns-count column so it's clear at a glance which properties
still need tagging.

**No way to remove a property tag once set.** Section 9.2's bulk-tagging requirement covered assigning a
property/city to campaigns, but nothing in the PRD or the original build addressed *un*-assigning one — the
bulk-tag dropdown's empty option meant "leave unchanged," not "clear." Fixed with a row-level control: clicking
a campaign's tagged Property name in the Campaign Monitoring table (Epic A) opens a small popover with "Remove
property tag," scoped to that single campaign, calling the same `bulkTagCampaigns` action with a clear sentinel.

**No way to delete an unused property.** Same gap at the Property entity level — once garbage/duplicate
properties existed (see the `reset-property-tagging.mjs` cleanup, Section 11), there was no in-app way to remove
one. Added a Delete action on `/dashboard/properties`, gated to properties with zero tagged campaigns
(`campaign.property_id` has no `ON DELETE` clause, so Postgres would reject the delete anyway if campaigns still
referenced it) — the server action re-checks this and throws a clear error rather than cascading, consistent
with this codebase's existing "never silently destroy data" pattern (see `deleteProperty` in
`app/dashboard/properties/actions.ts`).
