// One-off Sprint 0 verification script — not part of the app.
// Confirms RLS is actually enforced on the live Supabase project using only
// the public anon key (no service_role secret involved).
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

console.log("Checking as an unauthenticated (anon) client — should see zero workspaces...");
const { data: wsData, error: wsErr } = await supabase.from("workspace").select("*");
console.log("workspace select ->", { data: wsData, error: wsErr?.message ?? null });

const { data: memData, error: memErr } = await supabase.from("workspace_member").select("*");
console.log("workspace_member select ->", { data: memData, error: memErr?.message ?? null });

console.log("\nAttempting an anon INSERT into workspace (should be blocked — no insert policy exists yet)...");
const { data: insData, error: insErr } = await supabase
  .from("workspace")
  .insert({ name: "should-not-be-allowed" })
  .select();
console.log("workspace insert ->", { data: insData, error: insErr?.message ?? null });
