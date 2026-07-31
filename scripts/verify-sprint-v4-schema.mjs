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

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log("1. Marketing Manager role restored?");
const { data: roles } = await admin.from("role").select("name").is("workspace_id", null).order("name");
console.log(roles?.map((r) => r.name).join(", "));

console.log("\n2. campaign.city column exists?");
const { error: cityErr } = await admin.from("campaign").select("city").limit(1);
console.log(cityErr ? `ERROR: ${cityErr.message}` : "OK — column present");

console.log("\n3. profitability_snapshot table exists?");
const { error: snapErr, count } = await admin
  .from("profitability_snapshot")
  .select("*", { count: "exact", head: true });
console.log(snapErr ? `ERROR: ${snapErr.message}` : `OK — table present, ${count} rows so far`);

console.log("\n4. workspace.profitability_thresholds column exists?");
const { data: ws, error: wsErr } = await admin.from("workspace").select("profitability_thresholds").limit(1).single();
console.log(wsErr ? `ERROR: ${wsErr.message}` : `OK — value: ${JSON.stringify(ws?.profitability_thresholds)}`);

console.log("\n5. campaign.manager_id / executive_id / sales_team_employee actually gone?");
const { error: managerErr } = await admin.from("campaign").select("manager_id").limit(1);
console.log(managerErr ? `Confirmed gone: ${managerErr.message}` : "STILL PRESENT (unexpected)");
