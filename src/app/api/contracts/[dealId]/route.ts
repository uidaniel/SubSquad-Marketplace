import { NextResponse } from "next/server";
import { requireServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/data/relations";
import {
  generateContract,
  signedContractUrl,
} from "@/lib/contracts/generate";

/**
 * Downloading a contract.
 *
 * Authorised two ways, because the two parties reach it differently: an org
 * member signs in, and a creator holds the invite token that was sent to their
 * phone. Either is sufficient on their own deal and neither works on anyone
 * else's.
 *
 * Redirects to a short-lived signed URL rather than streaming the bytes. The
 * file never passes through a serverless function, and the link a user could
 * copy out of their address bar expires.
 */

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await params;
  const token = new URL(request.url).searchParams.get("token");

  const db = requireServiceClient();
  const { data: deal } = await db
    .from("deals")
    .select("id, invite_token, contract_pdf_url, campaigns(org_id)")
    .eq("id", dealId)
    .maybeSingle();

  if (!deal) return new NextResponse("Not found", { status: 404 });

  // The creator's proof: the unguessable token sent to their phone.
  let authorised = Boolean(token) && token === deal.invite_token;

  // The org's proof: a session that belongs to the org running the campaign.
  if (!authorised) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const campaign = one(deal.campaigns);
      const orgId = campaign?.org_id as string | undefined;
      if (orgId) {
        // Read through the user's own client so RLS decides, rather than
        // trusting an org id that arrived with the request.
        const { data: membership } = await supabase
          .from("org_members")
          .select("id")
          .eq("org_id", orgId)
          .eq("user_id", user.id)
          .maybeSingle();
        authorised = Boolean(membership);
      }
    }
  }

  // 404 rather than 403: someone without access should not learn the deal exists.
  if (!authorised) return new NextResponse("Not found", { status: 404 });

  let path = deal.contract_pdf_url as string | null;

  // Regenerated on demand when it is missing — a deal accepted before contracts
  // existed, or one whose generation failed after acceptance.
  if (!path) {
    const result = await generateContract(dealId);
    if ("error" in result) {
      return new NextResponse(result.error, { status: 500 });
    }
    path = result.url;
  }

  const url = await signedContractUrl(path);
  if (!url) return new NextResponse("Could not open the contract", { status: 500 });

  return NextResponse.redirect(url);
}
