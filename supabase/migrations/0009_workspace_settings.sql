-- Sprint 9: Admin & Role Management, Workspace Settings, Audit Logs
-- (DEVELOPMENT_PLAN.md Epic J/K). workspace_member, role, permission, and
-- audit_log already exist from Sprint 1 (0001_core_schema.sql) — this
-- migration only adds the workspace-level settings fields Epic J's
-- Settings screen needs (branding/timezone/currency are still open;
-- alert thresholds and notification channels are covered by the
-- workspace.profitability_thresholds jsonb column added in 0008, resp.
-- the alert rule config already in place).

alter table workspace add column if not exists timezone text not null default 'Asia/Kolkata';
alter table workspace add column if not exists currency text not null default 'INR';
