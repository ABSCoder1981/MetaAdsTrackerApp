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
    <div className="flex flex-1 items-center justify-center bg-background px-4">
      <form
        action={createWorkspace}
        className="w-full max-w-sm rounded-lg border border-border bg-surface p-8"
      >
        <div className="mb-5 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-tint text-sm text-accent">
            ◧
          </span>
          <span className="text-sm font-bold">Ads Tracker</span>
        </div>
        <h1 className="mb-1 text-xl font-bold">Create your workspace</h1>
        <p className="mb-6 text-sm text-muted">
          A workspace is the tenancy boundary for your ad accounts, campaigns, and team — see{" "}
          <code className="rounded bg-surface-raised px-1 py-0.5">docs/ARCHITECTURE.md</code>.
        </p>

        <label className="mb-1 block text-sm font-medium text-foreground">Workspace name</label>
        <input
          name="name"
          required
          placeholder="e.g. Ashiyana Real Estate"
          className="mb-6 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
        />

        <button
          type="submit"
          className="w-full rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background"
        >
          Create workspace
        </button>
      </form>
    </div>
  );
}
