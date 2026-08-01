"use client";

import { useRef } from "react";
import { setActiveWorkspace } from "@/app/dashboard/actions";
import type { WorkspaceMembership } from "@/lib/workspace";

export function WorkspaceSwitcher({
  workspaces,
  currentWorkspaceId,
}: {
  workspaces: WorkspaceMembership[];
  currentWorkspaceId: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={setActiveWorkspace} className="inline-block">
      <select
        name="workspace_id"
        defaultValue={currentWorkspaceId}
        onChange={() => formRef.current?.requestSubmit()}
        className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
      >
        {workspaces.map((w) => (
          <option key={w.workspace_id} value={w.workspace_id}>
            {w.workspace_name} ({w.role_name})
          </option>
        ))}
      </select>
    </form>
  );
}
