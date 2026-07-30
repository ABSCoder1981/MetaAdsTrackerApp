-- Sprint 0 deliverable: reusable Row-Level Security pattern for every
-- workspace-scoped table. This is a TEMPLATE/reference, not applied schema —
-- Sprint 1 creates the real entities (docs/DATA_MODEL.md) and applies this
-- pattern to each of them individually.
--
-- Every table that carries a workspace_id column should get the two
-- statements below, with <table_name> replaced.

-- 1. Minimal workspace + membership tables so the policy below has something
--    to join against. Sprint 1 supersedes these with the full schema in
--    docs/DATA_MODEL.md — this is just enough to prove the RLS pattern works.

create table if not exists workspace (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists workspace_member (
  workspace_id uuid not null references workspace(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  primary key (workspace_id, user_id)
);

alter table workspace enable row level security;
alter table workspace_member enable row level security;

-- Bootstrapping function: lets a newly authenticated user create their own
-- first workspace + membership row without being blocked by RLS on an empty
-- workspace_member table (the classic multi-tenant chicken-and-egg problem,
-- see docs/ARCHITECTURE.md §2).
create or replace function create_workspace_with_owner(workspace_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace_id uuid;
begin
  insert into workspace (name) values (workspace_name) returning id into new_workspace_id;
  insert into workspace_member (workspace_id, user_id, role)
    values (new_workspace_id, auth.uid(), 'owner');
  return new_workspace_id;
end;
$$;

-- A user can see workspaces they belong to.
create policy "workspace_select_own" on workspace
  for select using (
    id in (select workspace_id from workspace_member where user_id = auth.uid())
  );

-- A user can see their own membership rows (and, for admins, their
-- workspace's other members — refine in Sprint 1 once the role table exists).
create policy "workspace_member_select_own" on workspace_member
  for select using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- TEMPLATE for every future workspace-scoped table (campaign, lead,
-- daily_metrics, alert, etc. — see docs/DATA_MODEL.md). Copy and adapt:
--
--   alter table <table_name> enable row level security;
--
--   create policy "workspace_isolation_select" on <table_name>
--     for select using (
--       workspace_id in (select workspace_id from workspace_member where user_id = auth.uid())
--     );
--
--   create policy "workspace_isolation_write" on <table_name>
--     for all using (
--       workspace_id in (select workspace_id from workspace_member where user_id = auth.uid())
--     )
--     with check (
--       workspace_id in (select workspace_id from workspace_member where user_id = auth.uid())
--     );
--
-- RBAC-level restrictions (e.g. Executive sees only their own campaigns) are
-- ADDITIONAL policy conditions layered on top of this, never a replacement
-- for it — see docs/DATA_MODEL.md §5.
-- ---------------------------------------------------------------------------
