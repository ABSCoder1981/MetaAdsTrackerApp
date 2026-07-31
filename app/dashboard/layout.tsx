import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUserWorkspaces, resolveActiveWorkspaceId } from "@/lib/workspace";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";
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
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-black dark:text-zinc-50">Ads Tracker</span>
          <WorkspaceSwitcher workspaces={workspaces} currentWorkspaceId={currentWorkspaceId} />
          <Link href="/dashboard/campaigns" className="text-sm text-zinc-600 underline dark:text-zinc-400">
            Campaigns
          </Link>
          <Link href="/dashboard/properties" className="text-sm text-zinc-600 underline dark:text-zinc-400">
            Properties
          </Link>
          <Link href="/dashboard/leads" className="text-sm text-zinc-600 underline dark:text-zinc-400">
            Leads
          </Link>
          <Link href="/dashboard/profitability" className="text-sm text-zinc-600 underline dark:text-zinc-400">
            Profitability
          </Link>
          <Link href="/dashboard/alerts" className="text-sm text-zinc-600 underline dark:text-zinc-400">
            Alerts
          </Link>
          <Link href="/dashboard/ad-accounts" className="text-sm text-zinc-600 underline dark:text-zinc-400">
            Ad Accounts
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">{user.email}</span>
          <form action={signOut}>
            <button type="submit" className="text-sm text-zinc-600 underline dark:text-zinc-400">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
