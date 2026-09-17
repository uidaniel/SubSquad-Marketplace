import "server-only";

import { requireServiceClient } from "@/lib/supabase/service";
import { one } from "@/lib/data/relations";
import { formatDate } from "@/lib/utils";
import { formatNigerianPhone } from "@/lib/payouts/format";
import type { Brief } from "@/lib/domain";
import type { ContractData } from "./document";

/**
 * Turning an accepted deal into a PDF.
 *
 * Generated at acceptance rather than on demand, and stored, because the whole
 * point of the document is to fix what was agreed at a moment in time. A PDF
 * rendered later from current data would quietly follow any subsequent edit to
 * the campaign — which is precisely the thing a contract exists to prevent.
 *
 * Stored privately. It carries a creator's phone number and the IP they signed
 * from, and is reached through a short-lived signed URL.
 */

export const CONTRACTS_BUCKET = "contracts";

/** A human-quotable reference. Short enough to read down a phone line. */
export function contractReference(dealId: string): string {
  return `SSQ-${dealId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export async function generateContract(dealId: string): Promise<
  { url: string } | { error: string }
> {
  const db = requireServiceClient();

  const { data: deal } = await db
    .from("deals")
    .select(
      "id, fee_kobo, platform_fee_bps, fee_paid_by, deadline, contract_accepted_at, contract_ip, campaign_id, creators(display_name, handle, phone), campaigns(name, end_brand_name, brief, orgs(name, type))",
    )
    .eq("id", dealId)
    .maybeSingle();

  if (!deal) return { error: "That deal no longer exists." };

  const creator = one(deal.creators);
  if (!creator) return { error: "That deal has no creator." };

  const campaign = one(deal.campaigns);
  const org = one(campaign?.orgs);
  const brief = (campaign?.brief ?? {}) as Partial<Brief> &
    Record<string, unknown>;

  const feeKobo = Number(deal.fee_kobo);
  // The creator bears the platform fee only on their own deals, and only when
  // they agreed to. Showing a figure they do not receive is the fastest way to
  // make the document worthless to them.
  const takeHomeKobo =
    deal.fee_paid_by === "creator"
      ? feeKobo - Math.floor((feeKobo * Number(deal.platform_fee_bps)) / 10_000)
      : feeKobo;

  const usageRightsDays = Number(
    brief.usageRightsDays ?? brief.usage_rights_days ?? 90,
  );
  const disclosureTag = String(
    brief.disclosureTag ?? brief.disclosure_tag ?? "#ad",
  );

  const data: ContractData = {
    reference: contractReference(deal.id as string),
    creatorName: creator.display_name as string,
    creatorHandle: (creator.handle as string) ?? "",
    creatorPhone: creator.phone ? formatNigerianPhone(creator.phone as string) : null,
    brandName: (campaign?.end_brand_name as string) ?? "the brand",
    // Only named when an agency is running it. A brand contracting directly has
    // no agency to name, and inventing one confuses the parties.
    agencyName:
      org?.type === "agency" ? ((org.name as string) ?? null) : null,
    campaignName: (campaign?.name as string) ?? null,
    deliverable: "1 video",
    feeKobo,
    takeHomeKobo,
    deadline: deal.deadline ? formatDate(deal.deadline as string) : "the agreed date",
    usageRightsDays,
    disclosureTag,
    acceptedAt: (deal.contract_accepted_at as string) ?? null,
    acceptedIp: (deal.contract_ip as string) ?? null,
  };

  let pdf: Buffer;
  try {
    // Imported here rather than at module scope: @react-pdf/renderer pulls in a
    // large dependency tree, and nothing that merely touches a deal should pay
    // for it.
    const { renderToBuffer } = await import("@react-pdf/renderer");
    const { ContractDocument } = await import("./document");
    const { createElement } = await import("react");
    pdf = await renderToBuffer(
      createElement(ContractDocument, { data }) as never,
    );
  } catch (error) {
    return { error: `Could not render the contract: ${(error as Error).message}` };
  }

  const path = `${dealId}/${data.reference}.pdf`;
  const { error: uploadError } = await db.storage
    .from(CONTRACTS_BUCKET)
    .upload(path, pdf, { contentType: "application/pdf", upsert: true });

  if (uploadError) {
    return { error: `Could not store the contract: ${uploadError.message}` };
  }

  await db.from("deals").update({ contract_pdf_url: path }).eq("id", dealId);

  return { url: path };
}

/**
 * A temporary link to the stored contract.
 *
 * A day, rather than an hour: a creator may open it from an email days after
 * signing, and an expired contract link is a support conversation.
 */
export async function signedContractUrl(
  path: string,
  expiresInSeconds = 60 * 60 * 24,
): Promise<string | null> {
  const db = requireServiceClient();
  const { data } = await db.storage
    .from(CONTRACTS_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  return data?.signedUrl ?? null;
}
