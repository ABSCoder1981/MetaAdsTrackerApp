-- Deliberate deviation from the PRD (Sections 7.3-7.5 Manager/Supervisor/
-- Executive personas, 9.10 Team & Employee Performance, 11.3-11.5 their
-- dashboards, 21 RBAC matrix rows for these roles): the business decided
-- not to track campaigns by manager/executive at all. Removing the
-- concept end-to-end rather than leaving unused schema/dashboards behind.
-- See docs/DEVELOPMENT_PLAN.md's deviation log for the full rationale.

-- ---------------------------------------------------------------------------
-- 1. Drop the campaign -> sales_team_employee links first (FK dependents).
-- ---------------------------------------------------------------------------

alter table campaign drop column if exists manager_id;
alter table campaign drop column if exists executive_id;

-- ---------------------------------------------------------------------------
-- 2. Drop the org-chart table itself.
-- ---------------------------------------------------------------------------

drop table if exists sales_team_employee;

-- ---------------------------------------------------------------------------
-- 3. Remove the now-unused RBAC role templates. Any workspace_member still
--    pointing at one of these (shouldn't be any in practice) is reassigned
--    to Administrator first so the delete doesn't violate the FK.
-- ---------------------------------------------------------------------------

do $$
declare
  admin_role_id uuid;
  removed_role record;
begin
  select id into admin_role_id from role where workspace_id is null and name = 'Administrator';

  for removed_role in
    select id from role where workspace_id is null and name in ('Marketing Manager', 'Supervisor', 'Campaign Executive')
  loop
    update workspace_member set role_id = admin_role_id where role_id = removed_role.id;
  end loop;

  delete from role where workspace_id is null and name in ('Marketing Manager', 'Supervisor', 'Campaign Executive');
end $$;
