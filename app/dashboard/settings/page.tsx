import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveActiveWorkspaceId } from "@/lib/workspace";
import { getDashboardContext } from "@/lib/dashboard/context";
import { updateWorkspaceSettings, addMemberByEmail, changeMemberRole, removeMember } from "./actions";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const cookieStore = await cookies();
  const workspaceId = await resolveActiveWorkspaceId(supabase, cookieStore.get("active_workspace_id")?.value);
  if (!workspaceId || !user) return null;

  const context = await getDashboardContext(supabase, workspaceId, user.id);
  const { data: workspaceRow } = await supabase
    .from("workspace")
    .select("name, timezone, currency")
    .eq("id", workspaceId)
    .single();

  if (context.roleName !== "Administrator") {
    return (
      <div className="max-w-2xl">
        <h1 className="mb-2 text-2xl font-bold">Settings</h1>
        <p className="rounded-lg border border-border bg-surface p-4 text-sm text-muted">
          Only Administrators can view workspace settings.
        </p>
      </div>
    );
  }

  const admin = createAdminClient();
  const [{ data: roles }, { data: members }, { data: usersPage }] = await Promise.all([
    admin.from("role").select("id, name").is("workspace_id", null).order("name"),
    admin.from("workspace_member").select("user_id, role_id, role(name)").eq("workspace_id", workspaceId),
    admin.auth.admin.listUsers({ page: 1, perPage: 500 }),
  ]);

  const emailByUserId = new Map((usersPage?.users ?? []).map((u) => [u.id, u.email ?? "—"]));
  const memberRows = (members ?? []).map((m) => {
    const role = Array.isArray(m.role) ? m.role[0] : m.role;
    return {
      userId: m.user_id,
      email: emailByUserId.get(m.user_id) ?? "—",
      roleId: m.role_id as string,
      roleName: (role as { name?: string } | null)?.name ?? "—",
    };
  });

  return (
    <div className="max-w-3xl">
      <h1 className="mb-4 text-2xl font-bold">Settings</h1>

      <section className="mb-6 rounded-lg border border-border bg-surface p-4">
        <p className="mb-3 text-sm font-bold">Workspace</p>
        <form action={updateWorkspaceSettings} className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs text-muted">
            Name
            <input
              name="name"
              defaultValue={workspaceRow?.name ?? ""}
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            />
          </label>
          <label className="text-xs text-muted">
            Timezone
            <input
              name="timezone"
              defaultValue={workspaceRow?.timezone ?? "Asia/Kolkata"}
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            />
          </label>
          <label className="text-xs text-muted">
            Currency
            <input
              name="currency"
              defaultValue={workspaceRow?.currency ?? "INR"}
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            />
          </label>
          <button type="submit" className="col-span-full w-fit rounded-md bg-foreground px-3 py-1.5 text-sm text-background">
            Save workspace settings
          </button>
        </form>
      </section>

      <section className="mb-6 rounded-lg border border-border bg-surface p-4">
        <p className="mb-3 text-sm font-bold">Members</p>
        <div className="mb-4 flex flex-col gap-2">
          {memberRows.map((m) => (
            <div key={m.userId} className="flex flex-wrap items-center gap-2 border-b border-border py-2 text-sm last:border-b-0">
              <span className="min-w-[200px] flex-1 truncate">{m.email}</span>
              <form action={changeMemberRole} className="flex items-center gap-2">
                <input type="hidden" name="user_id" value={m.userId} />
                <select
                  name="role_id"
                  defaultValue={m.roleId}
                  className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                >
                  {(roles ?? []).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <button type="submit" className="rounded-md border border-border px-2 py-1 text-xs">
                  Update
                </button>
              </form>
              <form action={removeMember}>
                <input type="hidden" name="user_id" value={m.userId} />
                <button type="submit" className="rounded-md border border-bad px-2 py-1 text-xs text-bad">
                  Remove
                </button>
              </form>
            </div>
          ))}
        </div>

        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">Add member</p>
        <form action={addMemberByEmail} className="flex flex-wrap items-center gap-2">
          <input
            name="email"
            type="email"
            placeholder="Email of an existing account"
            required
            className="min-w-[220px] flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
          />
          <select name="role_id" required className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground">
            <option value="">Role…</option>
            {(roles ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-md bg-foreground px-3 py-1.5 text-sm text-background">
            Add member
          </button>
        </form>
        <p className="mt-2 text-xs text-faint">
          They need an existing account first — ask them to sign up at the login page, then add them here.
        </p>
      </section>

      <a href="/dashboard/audit-log" className="text-sm text-accent hover:underline">
        View audit log →
      </a>
    </div>
  );
}
