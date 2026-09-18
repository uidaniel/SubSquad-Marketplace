import { requireServiceClient } from "@/lib/supabase/service";
import { one } from "@/lib/data/relations";
import { dealClosedEmail } from "@/lib/messaging/email-templates";
import { sendTransactional, type SendOutcome } from "@/lib/messaging/send";

/**
 * Telling a creator their deal is over.
 *
 * Two places close a deal from the brand's side — refusing a counter-rate, and
 * cancelling a campaign — and both claimed the creator "has been told" while
 * writing only a row in deal_messages that no creator can see. This is the
 * telling. It never throws: the deal is closed either way, and a caller that
 * has already moved money must not roll back because an email bounced.
 */
export async function notifyDealClosed(
  dealId: string,
  reason: "declined" | "cancelled",
  note?: string | null,
): Promise<SendOutcome> {
  const db = requireServiceClient();

  const { data: deal } = await db
    .from("deals")
    .select("id, creators(display_name, email), campaigns(name, end_brand_name)")
    .eq("id", dealId)
    .maybeSingle();
  if (!deal) return { sent: false, reason: "no_channel", detail: "No such deal." };

  const creator = one(deal.creators) as
    | { display_name?: string; email?: string | null }
    | undefined;
  const campaign = one(deal.campaigns) as
    | { name?: string; end_brand_name?: string }
    | undefined;

  const mail = dealClosedEmail({
    creatorFirstName: (creator?.display_name ?? "there").split(" ")[0],
    brandName: campaign?.end_brand_name ?? "The brand",
    campaignName: campaign?.name ?? "this campaign",
    reason,
    note,
  });

  return sendTransactional({
    channel: "email",
    to: { email: creator?.email ?? null },
    subject: mail.subject,
    body: mail.html,
    text: mail.text,
    label: `deal ${reason} ${dealId}`,
  });
}

/** The same, for everyone an action closed at once. Failures are per-deal. */
export async function notifyDealsClosed(
  dealIds: readonly string[],
  reason: "declined" | "cancelled",
  note?: string | null,
): Promise<void> {
  await Promise.all(
    dealIds.map((id) => notifyDealClosed(id, reason, note).catch(() => undefined)),
  );
}
