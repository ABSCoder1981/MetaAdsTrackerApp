# Roadmap

Sprint-by-sprint schedule for `docs/DEVELOPMENT_PLAN.md`. Dates assume a **2-week sprint** cadence starting the
first Monday after this plan is approved. Adjust the start date in the table below once kickoff is confirmed —
everything else shifts relative to it.

Planning baseline date: **2026-07-30**. Assumed kickoff: **2026-08-03** (next Monday). Update if actual kickoff
differs.

| Sprint | Dates (assumed) | Phase | Focus | Key Deliverable |
|---|---|---|---|---|
| 0 | Aug 3 – Aug 14, 2026 | Foundation | Scaffold, infra, CI/CD | Next.js + Supabase project live, pipeline green |
| 1 | Aug 17 – Aug 28, 2026 | Foundation | Core schema, auth, RBAC/RLS | Schema migrated, workspace switcher shell working |
| 2 | Aug 31 – Sep 11, 2026 | Foundation | Meta API sync, pilot Ad Account | **Gate:** sync accuracy ±2% vs. Ads Manager |
| 3 | Sep 14 – Sep 25, 2026 | MVP | Campaign Monitoring & Detail (Epic A) | Sortable table, health indicators, bulk tagging live |
| 4 | Sep 28 – Oct 9, 2026 | MVP | Lead Analytics + Property Analytics (Epics B, C) | Unified lead table, property leaderboard, Estimated ROI labeling |
| 5 | Oct 12 – Oct 23, 2026 | MVP | Budget Pacing + Alerts engine (Epics D, E) | All 12 alert rules implemented and testable |
| 6 | Oct 26 – Nov 6, 2026 | MVP | Dashboards, part 1 (Epic F) | CEO + Director dashboards live |
| 7 | Nov 9 – Nov 20, 2026 | MVP | Dashboards, part 2 + Reports (Epics F, G) | Manager/Analyst dashboards, Daily Digest live — Supervisor/Executive dashboards dropped per PRD v4's flat org model (see `DEVELOPMENT_PLAN.md` Deviation Log) |
| 8 | Nov 23 – Dec 4, 2026 | MVP | Team Performance + Export Centre (Epics H, I) | Leaderboards, CSV/XLSX/PDF export |
| 9 | Dec 7 – Dec 18, 2026 | MVP | Admin/Role Mgmt + Audit Logs (Epics J, K) | Self-serve user/ad-account onboarding |
| 10 | Dec 21, 2026 – Jan 8, 2027* | MVP | Hardening & Acceptance | All Section 28 acceptance criteria pass |

\* Sprint 10 spans the year-end holiday period — treat this as a soft buffer sprint; the actual QA/hardening effort
may compress into 1.5 sprints with the remainder absorbed as slack, given typical availability over that window.

## Rollout Milestones (post-Sprint 10)

| Milestone | Target | Depends On |
|---|---|---|
| Stage 2 — onboard remaining Ad Accounts, run parallel with manual reporting for 1 week | Week of Jan 11, 2027 | Sprint 10 exit gate passed |
| Stage 3 — switch reporting fully to system | Week of Jan 18, 2027 | Stage 2 trust-building week complete |
| Stage 4 — dashboard rollout + short walkthrough to Managers (flat org model, PRD v4) | Week of Jan 25, 2027 | Stage 3 complete |
| Phase 2 kickoff | Not calendar-fixed — begins once Phase 1 exit gate is signed off and business priorities confirm Phase 2 scope | Stage 4 stable in production |
| Phase 3 kickoff | Trigger-based only — first white-label contract signed | N/A |

## Parallel / Non-Sprint-Bound Workstreams

Track these on a separate lightweight board, not folded into sprint velocity:

- **WhatsApp Business Account application** — submit in Sprint 0 (Aug 2026); Meta template approval lead time is
  external and unpredictable, so this should not gate any MVP sprint.
- **Naming-convention adoption / tagging completeness** — ongoing data-quality tracking from Sprint 3 onward.
- **Meta Marketing API version review** — quarterly check-in starting one quarter after Sprint 2's pilot sync goes
  live.

## Change Log

| Date | Change |
|---|---|
| 2026-07-30 | Initial roadmap drafted from PRD v1.0 and `DEVELOPMENT_PLAN.md` |
