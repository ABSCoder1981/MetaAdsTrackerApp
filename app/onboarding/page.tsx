import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createWorkspace } from "./actions";

export default async function OnboardingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: memberships } = await supabase.from("workspace_member").select("workspace_id").limit(1);

  if (memberships && memberships.length > 0) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
      <form
        action={createWorkspace}
        className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
      >
        <h1 className="mb-1 text-xl font-semibold text-black dark:text-zinc-50">Create your workspace</h1>
        <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
          A workspace is the tenancy boundary for your ad accounts, campaigns, and team — see{" "}
          <code className="rounded bg-zinc-200 px-1 py-0.5 dark:bg-zinc-800">docs/ARCHITECTURE.md</code>.
        </p>

        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Workspace name</label>
        <input
          name="name"
          required
          placeholder="e.g. Ashiyana Real Estate"
          className="mb-6 w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />

        <button
          type="submit"
          className="w-full rounded bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          Create workspace
        </button>
      </form>
    </div>
  );
}
