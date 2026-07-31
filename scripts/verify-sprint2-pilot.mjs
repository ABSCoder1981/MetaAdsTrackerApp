// Sprint 2 pilot validation: pull yesterday's synced metrics for the pilot
// ad account, ranked by spend, so they can be manually compared against
// Meta Ads Manager's own reported figures (±2% tolerance gate, PRD Section 28).
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

const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

console.log(`Top synced campaigns by spend for ${yesterday} (a fully-completed day, best for comparison):\n`);

const { data, error } = await admin
  .from("daily_metrics")
  .select("date, spend, impressions, reach, ctr, leads, cpl, campaign(name)")
  .eq("date", yesterday)
  .order("spend", { ascending: false })
  .limit(10);

if (error) {
  console.log("Error:", error.message);
  process.exitCode = 1;
} else if (!data || data.length === 0) {
  console.log(`No rows for ${yesterday} — trying today instead (partial day, less reliable for comparison)...`);
  const today = new Date().toISOString().slice(0, 10);
  const { data: todayData, error: todayErr } = await admin
    .from("daily_metrics")
    .select("date, spend, impressions, reach, ctr, leads, cpl, campaign(name)")
    .eq("date", today)
    .order("spend", { ascending: false })
    .limit(10);
  if (todayErr) console.log("Error:", todayErr.message);
  else
    todayData?.forEach((r) => {
      console.log(
        `${r.campaign?.name ?? "?"} | spend=${r.spend} | impressions=${r.impressions} | ctr=${r.ctr} | leads=${r.leads} | cpl=${r.cpl ?? "-"}`
      );
    });
} else {
  data.forEach((r) => {
    console.log(
      `${r.campaign?.name ?? "?"} | spend=${r.spend} | impressions=${r.impressions} | ctr=${r.ctr} | leads=${r.leads} | cpl=${r.cpl ?? "-"}`
    );
  });
}
