import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Minimal infra health check (NFR: Monitoring, docs/ARCHITECTURE.md §7).
 * Reports whether Supabase is configured and reachable — never returns
 * secret values, only booleans/status strings.
 */
export async function GET() {
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  if (!configured) {
    return NextResponse.json({ status: "ok", supabase: "not_configured" });
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.from("workspace").select("id").limit(1);
    return NextResponse.json({
      status: "ok",
      supabase: error ? `error: ${error.message}` : "connected",
    });
  } catch (e) {
    return NextResponse.json(
      { status: "ok", supabase: `error: ${e instanceof Error ? e.message : "unknown"}` },
      { status: 200 }
    );
  }
}
