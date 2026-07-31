import { linkMyEmployeeProfile } from "@/app/dashboard/actions";

export function LinkEmployeePrompt({ unlinkedEmployees }: { unlinkedEmployees: { id: string; name: string }[] }) {
  return (
    <div className="mb-6 rounded border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-700 dark:bg-amber-950">
      <p className="mb-2 font-medium text-amber-800 dark:text-amber-300">
        Your account isn&rsquo;t linked to a team member profile yet, so this dashboard can&rsquo;t scope to
        &ldquo;your&rdquo; campaigns. If you&rsquo;re one of these, link yourself:
      </p>
      <form action={linkMyEmployeeProfile} className="flex flex-wrap items-center gap-2">
        <select name="employee_id" required className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900">
          <option value="">Select your name…</option>
          {unlinkedEmployees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded bg-black px-3 py-1 text-white dark:bg-white dark:text-black">
          This is me
        </button>
      </form>
    </div>
  );
}
