import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserWorkspaces, resolveActiveWorkspaceId } from "@/lib/workspace";

export default async function DashboardPage() {
  const supabase = await createClient();
  const workspaces = await getUserWorkspaces(supabase);
  const cookieStore = await cookies();
  const activeWorkspaceId = await resolveActiveWorkspaceId(supabase, cookieStore.get("active_workspace_id")?.value);
  const current = workspaces.find((w) => w.workspace_id === activeWorkspaceId);

  return (
    <div className="max-w-2xl">
      <h1 className="mb-2 text-2xl font-semibold text-black dark:text-zinc-50">
        {current?.workspace_name}
      </h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Signed in as your role: <strong>{current?.role_name}</strong>. Role-based dashboard widgets
        (Section 11), campaign monitoring, and alerts land starting Sprint 3 — see{" "}
        <code className="rounded bg-zinc-200 px-1.5 py-0.5 text-sm dark:bg-zinc-800">docs/ROADMAP.md</code>.
      </p>
    </div>
  );
}
