-- Sprint 2: Meta Marketing API sync infrastructure (PRD Section 9.14).
--
-- Adds sync status tracking to ad_account, a sync_log table for
-- observability (feeds the "Sync/API failure" alert, Section 17, and the
-- Admin sync-status view), and enables Supabase Vault for encrypted Meta
-- System User token storage (business_manager.system_user_token_secret_ref
-- already existed as a column since Sprint 1 — this is where it gets used).

-- ---------------------------------------------------------------------------
-- 1. Supabase Vault — encrypted secret storage for Meta System User tokens.
--    Vault is a Supabase extension; safe to enable if not already present.
-- ---------------------------------------------------------------------------

create extension if not exists supabase_vault;

-- PostgREST (Supabase's REST/RPC layer) only exposes functions in the
-- schemas it's configured to serve — `vault` isn't one of them, so
-- vault.create_secret / vault.decrypted_secrets aren't callable directly
-- from supabase-js. These `public`-schema wrappers proxy to Vault and are
-- locked down to `service_role` only (never anon/authenticated) since they
-- handle raw secret values.

create or replace function store_meta_token(secret_value text, secret_name text)
returns uuid
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  new_id uuid;
begin
  select vault.create_secret(secret_value, secret_name) into new_id;
  return new_id;
end;
$$;

create or replace function get_meta_token(secret_id uuid)
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  token text;
begin
  select decrypted_secret into token from vault.decrypted_secrets where id = secret_id;
  return token;
end;
$$;

revoke execute on function store_meta_token(text, text) from public, anon, authenticated;
revoke execute on function get_meta_token(uuid) from public, anon, authenticated;
grant execute on function store_meta_token(text, text) to service_role;
grant execute on function get_meta_token(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 2. Sync status tracking on ad_account
-- ---------------------------------------------------------------------------

alter table ad_account add column if not exists last_synced_at timestamptz;
alter table ad_account add column if not exists last_sync_status text not null default 'never'; -- 'never' | 'success' | 'error'
alter table ad_account add column if not exists last_sync_error text;

-- ---------------------------------------------------------------------------
-- 3. sync_log — one row per sync attempt per ad account (observability +
--    the data behind the "sync failed" alert rule, Section 17).
-- ---------------------------------------------------------------------------

create table if not exists sync_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id) on delete cascade,
  ad_account_id uuid not null references ad_account(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running', -- 'running' | 'success' | 'error'
  error_message text,
  campaigns_synced integer,
  metrics_rows_synced integer
);

alter table sync_log enable row level security;

drop policy if exists "workspace_isolation_select" on sync_log;
create policy "workspace_isolation_select" on sync_log
  for select using (
    workspace_id in (select workspace_id from workspace_member where user_id = auth.uid())
  );

-- Writes to sync_log happen only from the server (service_role, which
-- bypasses RLS) — no write policy needed for authenticated users.

-- ---------------------------------------------------------------------------
-- 4. Unique constraints on Meta-sourced IDs — required for idempotent
--    upserts during sync (ON CONFLICT needs a matching unique/PK constraint).
--    Missing from the Sprint 1 schema since sync wasn't built yet.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'business_manager_workspace_meta_id_key') then
    alter table business_manager add constraint business_manager_workspace_meta_id_key unique (workspace_id, meta_bm_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ad_account_workspace_meta_id_key') then
    alter table ad_account add constraint ad_account_workspace_meta_id_key unique (workspace_id, meta_ad_account_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'campaign_workspace_meta_id_key') then
    alter table campaign add constraint campaign_workspace_meta_id_key unique (workspace_id, meta_campaign_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ad_set_workspace_meta_id_key') then
    alter table ad_set add constraint ad_set_workspace_meta_id_key unique (workspace_id, meta_ad_set_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ad_workspace_meta_id_key') then
    alter table ad add constraint ad_workspace_meta_id_key unique (workspace_id, meta_ad_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pixel_workspace_meta_id_key') then
    alter table pixel add constraint pixel_workspace_meta_id_key unique (workspace_id, meta_pixel_id);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Alert rule_key convention note (Section 17) — 'sync_failure' is the key
--    the alert-evaluation job (Sprint 5, Epic E) will use when it starts
--    reading sync_log/ad_account.last_sync_status. Nothing to create here
--    yet; documented so Sprint 5 doesn't have to reverse-engineer this.
-- ---------------------------------------------------------------------------
