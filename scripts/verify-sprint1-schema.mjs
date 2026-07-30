// One-off Sprint 1 verification — confirms the core schema migration applied
// correctly, using only the public anon key (no service_role secret).
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const envFile = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf-8");
const env = Object.fromEntries(
  envFile
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

console.log("1. System role templates (should list all 7 personas)...");
const { data: roles, error: rolesErr } = await supabase
  .from("role")
  .select("name, is_system_template")
  .is("workspace_id", null)
  .order("name");
console.log(roles?.map((r) => r.name).join(", ") ?? "none", rolesErr ? `ERROR: ${rolesErr.message}` : "");

console.log("\n2. Anon select on `campaign` (should be empty, no error — RLS scopes to zero rows)...");
const { data: campaigns, error: campErr } = await supabase.from("campaign").select("*");
console.log({ count: campaigns?.length, error: campErr?.message ?? null });

console.log("\n3. Anon select on `daily_metrics` (should be empty, no error)...");
const { data: metrics, error: metricsErr } = await supabase.from("daily_metrics").select("*");
console.log({ count: metrics?.length, error: metricsErr?.message ?? null });

console.log("\n4. Anon insert into `property` (should be rejected by RLS)...");
const { error: insErr } = await supabase.from("property").insert({ name: "test", workspace_id: null });
console.log({ error: insErr?.message ?? "NO ERROR (unexpected!)" });

console.log("\n5. Permissions seeded for Administrator role...");
const { data: adminRole } = await supabase.from("role").select("id").is("workspace_id", null).eq("name", "Administrator").single();
if (adminRole) {
  const { data: perms, error: permErr } = await supabase.from("permission").select("resource, action").eq("role_id", adminRole.id);
  console.log(perms ?? [], permErr ? `ERROR: ${permErr.message}` : "");
}
