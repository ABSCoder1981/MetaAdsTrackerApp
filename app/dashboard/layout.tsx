import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserWorkspaces, resolveActiveWorkspaceId } from "@/lib/workspace";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";
import { SidebarNav } from "@/components/dashboard/SidebarNav";
import { signOut } from "./actions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const workspaces = await getUserWorkspaces(supabase);

  if (workspaces.length === 0) {
    redirect("/onboarding");
  }

  const cookieStore = await cookies();
  const currentWorkspaceId = (await resolveActiveWorkspaceId(
    supabase,
    cookieStore.get("active_workspace_id")?.value
  ))!;

  return (
    <div className="mx-auto grid min-h-screen max-w-[1360px] grid-cols-[216px_1fr] items-start gap-4 px-6 py-4">
      <aside className="sticky top-4 rounded-lg border border-border bg-surface p-3">
        <div className="flex items-center gap-2 px-1 pb-3 text-sm font-bold">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-tint text-xs text-accent">
            ◧
          </span>
          Ads Tracker
        </div>
        <SidebarNav />
      </aside>

      <div className="flex min-w-0 flex-col gap-4">
        <header className="sticky top-4 z-10 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-4 py-2.5">
          <span className="font-bold text-sm">Dashboard</span>
          <WorkspaceSwitcher workspaces={workspaces} currentWorkspaceId={currentWorkspaceId} />
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-muted">{user.email}</span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-muted hover:text-foreground"
              >
                Sign out
              </button>
            </form>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
