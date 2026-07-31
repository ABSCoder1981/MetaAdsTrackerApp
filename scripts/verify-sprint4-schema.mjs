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

console.log("Checking workspace.webhook_secret exists and is populated...");
const { data, error } = await admin.from("workspace").select("id, name, webhook_secret").limit(5);
if (error) {
  console.log("ERROR:", error.message);
} else {
  data.forEach((w) => console.log(`${w.name}: webhook_secret ${w.webhook_secret ? "present" : "MISSING"}`));
}
