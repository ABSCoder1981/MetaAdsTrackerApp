// One-time cleanup: undoes property tagging that was written by the old
// naming-auto-parser (deleted per PRD v4). Clears campaign.property_id on
// every campaign in the workspace, then deletes every property row —
// giving a clean slate for manual re-tagging. Irreversible; run once.
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

const { data: workspace } = await admin.from("workspace").select("id, name").limit(1).single();
console.log(`Workspace: ${workspace.name} (${workspace.id})`);

const { count: campaignCount } = await admin
  .from("campaign")
  .select("id", { count: "exact", head: true })
  .eq("workspace_id", workspace.id)
  .not("property_id", "is", null);
console.log(`Campaigns currently tagged with a property: ${campaignCount}`);

const { count: propertyCount } = await admin
  .from("property")
  .select("id", { count: "exact", head: true })
  .eq("workspace_id", workspace.id);
console.log(`Property rows to delete: ${propertyCount}`);

console.log("\nStep 1: clearing campaign.property_id for all campaigns...");
const { error: clearErr } = await admin
  .from("campaign")
  .update({ property_id: null })
  .eq("workspace_id", workspace.id);
if (clearErr) throw new Error(clearErr.message);
console.log("  Done.");

console.log("\nStep 2: deleting all property rows...");
const { error: deleteErr } = await admin.from("property").delete().eq("workspace_id", workspace.id);
if (deleteErr) throw new Error(deleteErr.message);
console.log("  Done.");

const { count: remainingProperties } = await admin
  .from("property")
  .select("id", { count: "exact", head: true })
  .eq("workspace_id", workspace.id);
const { count: remainingTagged } = await admin
  .from("campaign")
  .select("id", { count: "exact", head: true })
  .eq("workspace_id", workspace.id)
  .not("property_id", "is", null);

console.log(`\nDone. Properties remaining: ${remainingProperties}. Campaigns still tagged: ${remainingTagged}.`);
