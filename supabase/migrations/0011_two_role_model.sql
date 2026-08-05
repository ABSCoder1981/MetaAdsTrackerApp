-- Deliberate deviation from the PRD (Sections 7.3-7.7 five-persona model,
-- 21 RBAC matrix): the business decided the CEO / Marketing Director /
-- Marketing Manager / Data Analyst split adds no real access-control value
-- for this team — everyone who isn't an Administrator just needs to see
-- the same data. Collapsing to a flat two-role model: Administrator (can
-- manage settings, members, thresholds) and User (view-only across the
-- workspace). See docs/DEVELOPMENT_PLAN.md's deviation log for the full
-- rationale.

-- ---------------------------------------------------------------------------
-- 1. Add the "User" system role template.
-- ---------------------------------------------------------------------------

insert into role (workspace_id, name, is_system_template)
values (null, 'User', true)
on conflict (name) where workspace_id is null do nothing;

-- ---------------------------------------------------------------------------
-- 2. Reassign any workspace_member on a role being removed (CEO, Marketing
--    Director, Marketing Manager, Data Analyst) to the new User role, then
--    delete those role templates (and their permission rows via FK cascade
--    from the explicit delete below).
-- ---------------------------------------------------------------------------

do $$
declare
  user_role_id uuid;
  removed_role record;
begin
  select id into user_role_id from role where workspace_id is null and name = 'User';

  for removed_role in
    select id from role
    where workspace_id is null
      and name in ('CEO', 'Marketing Director', 'Marketing Manager', 'Data Analyst')
  loop
    update workspace_member set role_id = user_role_id where role_id = removed_role.id;
    delete from permission where role_id = removed_role.id;
  end loop;

  delete from role
  where workspace_id is null
    and name in ('CEO', 'Marketing Director', 'Marketing Manager', 'Data Analyst');
end $$;

-- ---------------------------------------------------------------------------
-- 3. Re-seed permissions for the two remaining roles.
-- ---------------------------------------------------------------------------

do $$
declare
  r_admin uuid; r_user uuid;
begin
  select id into r_admin from role where workspace_id is null and name = 'Administrator';
  select id into r_user from role where workspace_id is null and name = 'User';

  delete from permission where role_id in (r_admin, r_user);

  insert into permission (role_id, resource, action) values
    (r_admin, 'workspace', 'view_all'), (r_admin, 'workspace', 'edit'), (r_admin, 'workspace', 'export'),
    (r_admin, 'settings', 'manage'), (r_admin, 'users', 'manage'),
    (r_user, 'workspace', 'view_all'), (r_user, 'workspace', 'export')
  on conflict do nothing;
end $$;
