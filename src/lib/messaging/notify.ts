import "server-only";

import { requireServiceClient } from "@/lib/supabase/service";
import { one } from "@/lib/data/relations";
import { sendTransactional } from "./send";
import { paidEmail, reminderEmail } from "./email-templates";
import { creatorUrl } from "@/lib/domains";
import { formatNaira } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { COMMON_BANKS } from "@/lib/payouts/banks";

/**
 * Telling a creator what happened to their money.
 *
 * These are transactional, not outreach: the recipient did the work and is
 * waiting to hear. Applying the once-a-week unsolicited cap to them would mean
 * a creator who was invited on Monday is not told on Wednesday that they have
 * been paid, which is the exact anxiety this product exists to remove.
 *
 * Every one of them fails quietly. A creator not receiving a notification is
 * bad; a payout being rolled back because an email bounced is worse, and the
 * money has already moved by the time these run.
 */

function bankName(code: string | null): string {
  if (!code) return "your bank";
  return COMMON_BANKS.find((b) => b.code === code)?.name ?? "your bank";
}

/** Where to reach them, preferring the channel they actually read. */
function channelFor(creator: Record<string, unknown>) {
  const phone = (creator.phone as string) ?? null;
  const email = (creator.email as string) ?? null;
  if (phone) return { channel: "whatsapp" as const, phone, email };
  if (email) return { channel: "email" as const, phone, email };
  return null;
}

/**
 * The money has left.
 *
 * Sent when the transfer is confirmed, not when it is submitted — a creator
 * told "paid" who then watches nothing arrive trusts the next message less.
 */
export async function notifyCreatorPaid(payoutId: string): Promise<void> {
  try {
    const db = requireServiceClient();
    const { data: payout } = await db
      .from("payouts")
      .select(
        "id, amount_kobo, deal_id, creators(display_name, phone, email, payout_bank_code, payout_account_number), deals(campaigns(end_brand_name))",
      )
      .eq("id", payoutId)
      .maybeSingle();

    if (!payout) return;
    const creator = one(payout.creators);
    if (!creator) return;

    const to = channelFor(creator);
    if (!to) return;

    const firstName = String(creator.display_name ?? "there").split(" ")[0];
    const amount = Number(payout.amount_kobo);
    const account = (creator.payout_account_number as string) ?? "";
    const deal = one(payout.deals);
    const campaign = one(deal?.campaigns);
    const brand = (campaign?.end_brand_name as string) ?? "your deal";

    const mail = paidEmail({
      creatorFirstName: firstName,
      brandName: brand,
      amountKobo: amount,
      bankName: bankName(creator.payout_bank_code as string | null),
      accountLast4: account.slice(-4),
      walletUrl: creatorUrl("/wallet"),
    });

    await sendTransactional({
      channel: to.channel,
      to: { phone: to.phone, email: to.email },
      subject: mail.subject,
      text: mail.text,
      label: `payout notice for ${payoutId}`,
      body:
        to.channel === "whatsapp"
          ? `${formatNaira(amount)} for the ${brand} deal has gone out to your ${bankName(
              creator.payout_bank_code as string | null,
            )} account ending ${account.slice(-4)}.\n\nMost banks show it within minutes. If it has not arrived by tomorrow, reply here.`
          : mail.html,
    });
  } catch (error) {
    // The money has already moved. A failed notification is not worth undoing it.
    console.error("[notify] could not tell the creator they were paid", error);
  }
}

/**
 * A deadline is close.
 *
 * Written as help rather than as a warning. A creator who misses a deadline
 * usually forgot or hit something, and a threatening reminder makes them avoid
 * the conversation rather than ask for the extra day they need.
 */
export async function notifyDeadlineApproaching(
  dealId: string,
  daysLeft: number,
): Promise<void> {
  try {
    const db = requireServiceClient();
    const { data: deal } = await db
      .from("deals")
      .select(
        "id, fee_kobo, deadline, status, creators(display_name, phone, email, do_not_contact), campaigns(end_brand_name)",
      )
      .eq("id", dealId)
      .maybeSingle();

    if (!deal) return;
    // Nothing to chase once the work is in.
    if (!["contract_signed", "revision_requested"].includes(deal.status as string)) {
      return;
    }

    const creator = one(deal.creators);
    if (!creator || creator.do_not_contact) return;

    const to = channelFor(creator);
    if (!to) return;

    const firstName = String(creator.display_name ?? "there").split(" ")[0];
    const campaign = one(deal.campaigns);
    const brand = (campaign?.end_brand_name as string) ?? "the brand";
    const dealLink = creatorUrl(`/deals/${dealId}`);

    const mail = reminderEmail({
      creatorFirstName: firstName,
      brandName: brand,
      feeKobo: Number(deal.fee_kobo),
      deadline: formatDate(deal.deadline as string),
      daysLeft,
      dealUrl: dealLink,
    });

    const when =
      daysLeft <= 0 ? "today" : daysLeft === 1 ? "tomorrow" : `in ${daysLeft} days`;

    await sendTransactional({
      channel: to.channel,
      to: { phone: to.phone, email: to.email },
      subject: mail.subject,
      text: mail.text,
      label: `deadline reminder for ${dealId}`,
      body:
        to.channel === "whatsapp"
          ? `Hi ${firstName} — your ${brand} post is due ${when}. ${formatNaira(
              Number(deal.fee_kobo),
            )} is waiting for you.\n\n${dealLink}\n\nNeed more time? Just reply here.`
          : mail.html,
    });

    await db.from("deal_messages").insert({
      deal_id: dealId,
      direction: "outbound",
      channel: to.channel,
      body: `Deadline reminder — due ${when}.`,
      ai_draft: false,
      sent_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[notify] could not send a deadline reminder", error);
  }
}
