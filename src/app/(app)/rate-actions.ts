"use server";

import { revalidatePath } from "next/cache";
import { requireServiceClient } from "@/lib/supabase/service";
import { getCurrentOrg, getCurrentUser } from "@/lib/data/queries";
import { acceptRate, counterRate, declineRate, pendingRates } from "@/lib/deals/rates";
import { toBrief } from "@/lib/data/brief";
import { creatorUrl } from "@/lib/domains";
import { one } from "@/lib/data/relations";
import { formatDate } from "@/lib/utils";
import { notifyDealClosed } from "@/lib/deals/notify";

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

/**
 * Answering a creator who has named their rate.
 *
 * Accepting is the moment the deal becomes real: the fee is fixed, the terms
 * bind, and the creator can sign. So it is also the moment — and the first
 * honest moment — to send them those terms in full.
 */
export async function respondToRate(
  dealId: string,
  decision: { kind: "accept" } | { kind: "counter"; amountKobo: number; note: string } | { kind: "decline"; note: string },
): Promise<ActionResult> {
  const user = await getCurrentUser();

  const result =
    decision.kind === "accept"
      ? await acceptRate(dealId, user.userId)
      : decision.kind === "counter"
        ? await counterRate(dealId, decision.amountKobo, decision.note)
        : await declineRate(dealId, decision.note);

  if (result.ok && decision.kind === "accept") {
    // Fails quietly: the rate is agreed either way, and a creator who does not
    // get the email still sees the deal on their dashboard.
    await sendDealAgreed(dealId).catch(() => {});
  }
  if (result.ok && decision.kind === "decline") {
    // The button says "the creator has been told". This is what makes it true.
    await notifyDealClosed(dealId, "declined", decision.note).catch(() => {});
  }

  revalidatePath("/approvals");
  revalidatePath("/outreach");
  revalidatePath("/");

  const { data: deal } = await requireServiceClient()
    .from("deals")
    .select("campaign_id")
    .eq("id", dealId)
    .maybeSingle();
  if (deal?.campaign_id) revalidatePath(`/campaigns/${deal.campaign_id}`);

  return result;
}

/** The second email: the terms, now that there are terms. */
async function sendDealAgreed(dealId: string): Promise<void> {
  const db = requireServiceClient();

  const { data: deal } = await db
    .from("deals")
    .select(
      "id, fee_kobo, deadline, invite_token, creators(display_name, email), campaigns(name, end_brand_name, brief)",
    )
    .eq("id", dealId)
    .maybeSingle();
  if (!deal) return;

  const creator = one(deal.creators) as
    | { display_name?: string; email?: string }
    | undefined;
  if (!creator?.email) return;

  const campaign = one(deal.campaigns) as
    | { name?: string; end_brand_name?: string; brief?: unknown }
    | undefined;
  const brief = toBrief(campaign?.brief);

  const { dealAgreedEmail } = await import("@/lib/messaging/email-templates");
  const { sendTransactional } = await import("@/lib/messaging/send");

  const mail = dealAgreedEmail({
    creatorFirstName: (creator.display_name ?? "there").split(" ")[0],
    brandName: campaign?.end_brand_name ?? "The brand",
    campaignName: campaign?.name ?? "this campaign",
    deliverable: "1 video",
    feeKobo: Number(deal.fee_kobo),
    deadline: deal.deadline ? formatDate(deal.deadline as string) : "the agreed date",
    mustInclude: [...brief.keyMessages, ...brief.mustInclude],
    mustAvoid: brief.mustAvoid,
    disclosureTag: brief.disclosureTag,
    usageRightsDays: brief.usageRightsDays,
    dealUrl: creatorUrl(`/i/${deal.invite_token}`),
  });

  await sendTransactional({
    channel: "email",
    to: { email: creator.email },
    subject: mail.subject,
    body: mail.html,
    text: mail.text,
    label: `deal agreed ${dealId}`,
  });
}

/** Everything waiting on a decision about money. */
export async function getPendingRates() {
  const org = await getCurrentOrg();
  return pendingRates(org.id);
}
