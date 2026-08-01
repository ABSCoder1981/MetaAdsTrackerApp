import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Records an audit_log row (Section 9.15). Uses the service-role client
 * because no regular-client insert policy exists on audit_log (the only
 * existing writer, create_workspace_with_owner, is a SECURITY DEFINER
 * function) — callers must gate the action itself first (Administrator
 * check), the same posture as every other elevated action in this app.
 */
export async function logAuditEvent(input: {
  workspaceId: string;
  userId: string;
  action: string;
  details?: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  await admin.from("audit_log").insert({
    workspace_id: input.workspaceId,
    user_id: input.userId,
    action: input.action,
    details: input.details ?? {},
  });
}
