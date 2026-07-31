-- Sprint 4: landing-page/CRM lead webhook needs a way to authenticate
-- requests that aren't a logged-in user's session — external systems (a
-- landing page form handler, a CRM) can't hold a Supabase session cookie.
-- A per-workspace opaque token is the simplest thing that works: the
-- webhook URL embeds it, and the route handler (app/api/leads/webhook)
-- looks up the workspace by this value instead of by auth.uid().

alter table workspace add column if not exists webhook_secret uuid not null default gen_random_uuid();

-- Not selectable by normal authenticated queries beyond what RLS already
-- scopes to the user's own workspace — the existing workspace_select_own
-- policy (Sprint 0 template) already covers this column since it's on the
-- same row, no new policy needed. Anyone who can see their own workspace
-- row can see their own webhook secret, which is correct (it's meant to be
-- copyable from the app UI).
