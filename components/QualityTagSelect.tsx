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
        className="rounded-md border border-border bg-background px-1 py-0.5 text-xs text-foreground"
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
