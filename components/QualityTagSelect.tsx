"use client";

import { useRef } from "react";
import { updateLeadQualityTag } from "@/app/dashboard/leads/actions";

export function QualityTagSelect({ leadId, currentTag }: { leadId: string; currentTag: string | null }) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={updateLeadQualityTag} className="flex items-center gap-1">
      <input type="hidden" name="lead_id" value={leadId} />
      <select
        name="quality_tag"
        defaultValue={currentTag ?? ""}
        onChange={() => formRef.current?.requestSubmit()}
        className="rounded border border-zinc-300 px-1 py-0.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
      >
        <option value="">Untagged</option>
        <option value="hot">Hot</option>
        <option value="warm">Warm</option>
        <option value="cold">Cold</option>
        <option value="unqualified">Unqualified</option>
      </select>
    </form>
  );
}
