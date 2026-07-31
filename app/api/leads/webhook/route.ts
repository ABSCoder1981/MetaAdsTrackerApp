import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Landing-page / CRM lead ingestion (PRD Section 5.1: leads arrive via
 * pixel/CRM webhook for non-Meta-Lead-Form campaigns — the second of the
 * two required ingestion paths, alongside the Meta Lead Ads sync).
 *
 * Auth: a per-workspace opaque token (?token=), not a user session — the
 * caller is an external landing page/CRM, not a logged-in browser.
 */
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: workspace } = await admin.from("workspace").select("id").eq("webhook_secret", token).single();
  if (!workspace) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  let body: { meta_campaign_id?: string; campaign_name?: string; property_name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.meta_campaign_id && !body.campaign_name) {
    return NextResponse.json({ error: "meta_campaign_id or campaign_name is required" }, { status: 400 });
  }

  let campaignQuery = admin.from("campaign").select("id, property_id").eq("workspace_id", workspace.id);
  campaignQuery = body.meta_campaign_id
    ? campaignQuery.eq("meta_campaign_id", body.meta_campaign_id)
    : campaignQuery.ilike("name", body.campaign_name!);
  const { data: campaign } = await campaignQuery.maybeSingle();

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found for this workspace" }, { status: 404 });
  }

  let propertyId = campaign.property_id;
  if (!propertyId && body.property_name) {
    const { data: existingProperty } = await admin
      .from("property")
      .select("id")
      .eq("workspace_id", workspace.id)
      .ilike("name", body.property_name)
      .maybeSingle();

    propertyId =
      existingProperty?.id ??
      (
        await admin
          .from("property")
          .insert({ workspace_id: workspace.id, name: body.property_name })
          .select("id")
          .single()
      ).data?.id ??
      null;
  }

  const { data: lead, error } = await admin
    .from("lead")
    .insert({
      workspace_id: workspace.id,
      campaign_id: campaign.id,
      property_id: propertyId,
      source: "landing_page_webhook",
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: lead.id, status: "ok" });
}
