// One-off Sprint 1 end-to-end verification: real sign-up, real workspace
// creation via the RPC, and confirmation that RLS scopes data correctly for
// an authenticated session (not just anon). Uses only the public anon key.
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

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const stamp = Date.now();
const emailA = `easyworkrealestate+sprint1a${stamp}@gmail.com`;
const emailB = `easyworkrealestate+sprint1b${stamp}@gmail.com`;
const password = "TestPassword123!";

async function signUp(email) {
  const client = createClient(url, key);
  const { data, error } = await client.auth.signUp({ email, password });
  return { client, data, error };
}

console.log("1. Signing up user A...");
const { client: clientA, data: dataA, error: errA } = await signUp(emailA);
console.log({ hasSession: !!dataA?.session, hasUser: !!dataA?.user, error: errA?.message ?? null });

if (!dataA?.session) {
  console.log(
    "\nNo session returned on sign-up — email confirmation is likely required by this Supabase project's Auth settings."
  );
  console.log("Skipping the rest of the authenticated-session test until that's resolved.");
  process.exitCode = 0;
} else {

console.log("\n2. User A creates a workspace via create_workspace_with_owner...");
const { data: wsId, error: wsErr } = await clientA.rpc("create_workspace_with_owner", {
  workspace_name: `Sprint1 Test Workspace ${stamp}`,
});
console.log({ workspaceId: wsId, error: wsErr?.message ?? null });

console.log("\n3. User A reads their own workspace_member row...");
const { data: memA, error: memAErr } = await clientA
  .from("workspace_member")
  .select("workspace_id, role(name)");
console.log(memA, memAErr?.message ?? "");

console.log("\n4. Signing up an unrelated user B (no workspace of their own)...");
const { client: clientB, data: dataB, error: errB } = await signUp(emailB);
console.log({ hasSession: !!dataB?.session, error: errB?.message ?? null });

if (dataB?.session) {
  console.log("\n5. User B reads workspace_member (should be empty — zero workspaces of their own)...");
  const { data: memB, error: memBErr } = await clientB.from("workspace_member").select("*");
  console.log({ count: memB?.length, error: memBErr?.message ?? null });

  console.log("\n6. User B attempts to read user A's workspace row directly by ID (should be empty)...");
  const { data: crossRead, error: crossErr } = await clientB
    .from("workspace")
    .select("*")
    .eq("id", wsId);
  console.log({ count: crossRead?.length, error: crossErr?.message ?? null });
}

console.log("\nDone. (Test users left in the auth.users table — harmless, but you can delete them from Supabase → Authentication → Users if you'd rather keep it clean.)");
}
