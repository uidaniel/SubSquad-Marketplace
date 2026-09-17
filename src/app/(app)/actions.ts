"use server";

import { revalidatePath } from "next/cache";
import { requireServiceClient } from "@/lib/supabase/service";
import { accountFor, balanceOf, InsufficientFunds, post } from "@/lib/ledger/post";
import {
  buildDeposit,
  buildLock,
  buildRefund,
  fundingRequiredFor,
} from "@/lib/ledger/transactions";
import { releaseDeal } from "@/lib/deals/release";
import {
  checkSendAllowed,
  chooseChannel,
  UNSOLICITED_COOLDOWN_DAYS,
} from "@/lib/messaging/policy";
import { getCurrentOrg, getCurrentUser } from "@/lib/data/queries";
import { formatNaira, parseNairaInput } from "@/lib/money";
import { creatorUrl } from "@/lib/domains";
import { env, integrations } from "@/lib/env";
import { formatDate } from "@/lib/utils";
import { one } from "@/lib/data/relations";

/**
 * Everything the org app can change.
 *
 * Each action returns a result rather than throwing at the UI, so a refusal —
 * not enough money, a creator who opted out — is shown as a sentence the person
 * can act on instead of an error page. The rules themselves live in lib; these
 * are the seams between a button and those rules.
 */

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

/* ==========================================================================
   Money in
   ========================================================================== */

/**
 * Records a deposit into a client's wallet.
 *
 * In production this is driven by a verified Paystack webhook, never by a form.
 * The manual path exists because a Nigerian agency's client will pay by bank
 * transfer, and someone has to be able to record that without waiting for a
 * card rail to catch up — so it is restricted to a named person and always
 * carries the reference it was reconciled against.
 */
export async function recordDeposit(
  spaceId: string,
  amountText: string,
  reference: string,
): Promise<ActionResult> {
  const amountKobo = parseNairaInput(amountText);
  if (amountKobo === null || amountKobo <= 0) {
    return { ok: false, message: "Enter an amount, like 500,000." };
  }
  if (!reference.trim()) {
    return {
      ok: false,
      message: "Add the bank reference so this can be reconciled later.",
    };
  }

  const db = requireServiceClient();
  const { data: space } = await db
    .from("spaces")
    .select("id, org_id, name")
    .eq("id", spaceId)
    .single();
  if (!space) return { ok: false, message: "That client space no longer exists." };

  const user = await getCurrentUser();

  try {
    const clearing = await accountFor("paystack_clearing");
    const wallet = await accountFor("space_wallet", {
      orgId: space.org_id,
      spaceId: space.id,
    });

    const result = await post(
      buildDeposit({
        clearingAccountId: clearing,
        destinationAccountId: wallet,
        amountKobo,
        reference: reference.trim(),
        memo: `Deposit for ${space.name}`,
      }),
      { createdBy: user.userId },
    );

    revalidatePath("/wallet");
    revalidatePath("/");

    return {
      ok: true,
      message: result.alreadyApplied
        ? `That reference was already recorded — nothing was added twice.`
        : `${formatNaira(amountKobo)} added to ${space.name}.`,
    };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}

/**
 * Funds a campaign: moves budget from the client's wallet into escrow.
 *
 * The amount must cover the creator fees *and* the platform fee on top, because
 * a campaign that can pay its creators but not its own fee would fail at the
 * last step — when the creator has already done the work.
 */
export async function fundCampaign(campaignId: string): Promise<ActionResult> {
  const db = requireServiceClient();

  const { data: campaign } = await db
    .from("campaigns")
    .select("*, campaign_slots(count, fee_kobo)")
    .eq("id", campaignId)
    .single();
  if (!campaign) return { ok: false, message: "That campaign no longer exists." };

  const slots = (campaign.campaign_slots ?? []) as { count: number; fee_kobo: number }[];
  const creatorFees = slots.reduce(
    (sum, s) => sum + Number(s.fee_kobo) * Number(s.count),
    0,
  );
  if (creatorFees <= 0) {
    return {
      ok: false,
      message: "Add at least one deliverable and a fee before funding.",
    };
  }

  const required = fundingRequiredFor(creatorFees, Number(campaign.platform_fee_bps));
  const user = await getCurrentUser();

  try {
    const wallet = await accountFor("space_wallet", {
      orgId: campaign.org_id,
      spaceId: campaign.space_id,
    });
    const escrow = await accountFor("campaign_escrow", {
      orgId: campaign.org_id,
      spaceId: campaign.space_id,
      campaignId: campaign.id,
    });

    // Already funded is a normal thing to ask for, not a failure: a second tab,
    // a back button, a double tap on a slow connection. It must never post a
    // second lock — that is the client's money leaving the wallet twice.
    const alreadyHeld = await balanceOf(escrow);
    if (alreadyHeld >= required) {
      return {
        ok: true,
        message: `${formatNaira(alreadyHeld)} is already locked in escrow for this campaign. Nothing further was taken.`,
      };
    }

    const result = await post(
      buildLock({
        spaceWalletAccountId: wallet,
        escrowAccountId: escrow,
        amountKobo: required - alreadyHeld,
        memo: `Funded ${campaign.name}`,
        // The ledger's own guard, in case two requests get past the check above
        // at the same moment. One campaign, one lock.
        reference: `lock:${campaign.id}`,
      }),
      { createdBy: user.userId, requireFunds: [wallet] },
    );

    if (result.alreadyApplied) {
      return {
        ok: true,
        message: "This campaign was already funded. Nothing further was taken.",
      };
    }

    await db
      .from("campaigns")
      .update({ status: "funded", budget_kobo: required })
      .eq("id", campaign.id);

    // The funding screen itself was missing here, so it went on offering a
    // button to lock money that was already locked.
    revalidatePath(`/campaigns/${campaign.id}/fund`);
    revalidatePath(`/campaigns/${campaign.id}`);
    revalidatePath("/campaigns");
    revalidatePath("/wallet");
    revalidatePath("/");

    return {
      ok: true,
      message: `${formatNaira(required)} locked in escrow. Nobody is contacted until this is done — now outreach can start.`,
    };
  } catch (error) {
    if (error instanceof InsufficientFunds) {
      return {
        ok: false,
        message: `This client's wallet holds ${formatNaira(error.availableKobo)}, and ${formatNaira(error.requiredKobo)} is needed — creator fees plus the ${Number(campaign.platform_fee_bps) / 100}% fee on top. Add funds first.`,
      };
    }
    return { ok: false, message: (error as Error).message };
  }
}

/* ==========================================================================
   Shortlist
   ========================================================================== */

/**
 * Turns approved shortlist entries into invited deals.
 *
 * It creates the deals and drafts an invite per creator; it does not send
 * anything. The drafts land in the outreach queue for a person to approve,
 * which is the rule the whole product rests on.
 */
export async function approveShortlist(
  campaignId: string,
  removedItemIds: string[],
): Promise<ActionResult> {
  const db = requireServiceClient();

  // `approved` rows are included deliberately, not just `proposed` ones.
  //
  // An earlier version marked the whole shortlist approved even when it created
  // no deals, which left four rows saying "approved" with nothing behind them
  // and a button that answered "there is nothing left to approve". A row is
  // only really done when a deal exists for that creator, so that — not the
  // status column — is what decides here.
  const { data: items } = await db
    .from("shortlist_items")
    .select("*, creators(id, display_name, handle, phone, email, whatsapp_opt_in, do_not_contact, last_contacted_at)")
    .eq("campaign_id", campaignId)
    .in("status", ["proposed", "approved"]);

  if (!items?.length) {
    return { ok: false, message: "There is nothing left to approve on this shortlist." };
  }

  const { data: existingDeals } = await db
    .from("deals")
    .select("creator_id")
    .eq("campaign_id", campaignId);
  const alreadyHasDeal = new Set(
    (existingDeals ?? []).map((d) => d.creator_id as string),
  );

  const removed = new Set(removedItemIds);
  const approved = items.filter(
    (i) => !removed.has(i.id) && !alreadyHasDeal.has(i.creator_id as string),
  );

  if (approved.length === 0) {
    const everyoneInvited = items.every((i) =>
      alreadyHasDeal.has(i.creator_id as string),
    );
    return {
      ok: false,
      message: everyoneInvited
        ? "Everyone on this shortlist already has a deal. Check Outreach for their invites."
        : "Every creator was removed, so there is nothing to send.",
    };
  }

  const { data: campaign } = await db
    .from("campaigns")
    .select("id, name, end_brand_name, deadline")
    .eq("id", campaignId)
    .single();

  let created = 0;
  const skippedDetail: {
    handle: string;
    reason: string;
    availableFrom: string | null;
  }[] = [];

  // Drafts are written after the loop, all at once. Eighteen sequential model
  // calls would exceed a serverless function's ceiling; in parallel they take
  // about as long as the slowest one.
  const pendingDrafts: {
    dealId: string;
    channel: "whatsapp" | "email";
    input: import("@/lib/ai/invites").InviteDraftInput;
  }[] = [];

  for (const item of approved) {
    const creator = item.creators as {
      id: string;
      display_name: string;
      phone: string | null;
      email: string | null;
      whatsapp_opt_in: boolean;
      do_not_contact: boolean;
      last_contacted_at: string | null;
      handle: string | null;
    };

    // Checked before a deal is created, not before it is sent: a creator who
    // cannot be contacted should not end up with a deal sitting against their
    // name that nobody will ever act on.
    const contact = {
      doNotContact: creator.do_not_contact,
      lastUnsolicitedAt: creator.last_contacted_at,
      phone: creator.phone,
      email: creator.email,
      whatsappOptIn: creator.whatsapp_opt_in,
    };

    const allowed = checkSendAllowed(contact, {});
    if (!allowed.allowed) {
      // Named, with the reason and when they free up. "4 creators were skipped"
      // tells an agency nothing they can act on, and this is the step where a
      // whole campaign quietly reaches nobody.
      skippedDetail.push({
        handle: creator.handle ?? creator.display_name,
        reason: allowed.reason,
        availableFrom:
          allowed.reason === "rate_limited" && creator.last_contacted_at
            ? new Date(
                new Date(creator.last_contacted_at).getTime() +
                  UNSOLICITED_COOLDOWN_DAYS * 86_400_000,
              ).toISOString()
            : null,
      });
      continue;
    }

    // The channel must be one this deployment can actually send on. Drafting a
    // WhatsApp message when no WhatsApp account is connected produces an
    // outreach queue full of things that will never go out.
    const channel = chooseChannel(contact, {
      whatsapp: integrations.whatsapp,
      email: integrations.resend,
    });
    if (channel === null || channel === "manual") {
      skippedDetail.push({
        handle: creator.handle ?? creator.display_name,
        reason: "no_channel",
        availableFrom: null,
      });
      continue;
    }

    const { data: deal } = await db
      .from("deals")
      .insert({
        campaign_id: campaignId,
        creator_id: creator.id,
        slot_id: item.slot_id,
        origin: "campaign",
        fee_kobo: item.estimated_fee_kobo,
        platform_fee_bps: 1200,
        fee_paid_by: "brand",
        status: "invited",
        deadline: campaign?.deadline ?? null,
      })
      .select("id, invite_token")
      .single();

    if (!deal) continue;

    // Drafted, not sent. It waits in the ops inbox until a person approves it,
    // which is the rule for everything the platform says on an agency's behalf.
    pendingDrafts.push({
      dealId: deal.id,
      channel,
      input: {
        creatorFirstName: creator.display_name.split(" ")[0],
        creatorHandle: creator.handle ?? creator.display_name,
        brandName: campaign?.end_brand_name ?? "A brand",
        deliverable: "1 video",
        feeKobo: Number(item.estimated_fee_kobo),
        deadline: (campaign?.deadline as string) ?? null,
        inviteUrl: creatorUrl(`/i/${deal.invite_token}`),
        channel,
      },
    });

    created += 1;
  }

  // Nobody could be contacted. Leave the shortlist exactly as it was and say
  // why: marking it approved and flipping the campaign to "outreach" would make
  // a run that reached nobody look like a run that worked, and the shortlist
  // would disappear with it.
  if (created === 0) {
    return {
      ok: false,
      message: `Nothing was sent. ${describeSkips(skippedDetail)} The shortlist is untouched.`,
    };
  }

  await db
    .from("shortlist_items")
    .update({ status: "approved" })
    .in(
      "id",
      approved.map((i) => i.id),
    );
  if (removed.size) {
    await db
      .from("shortlist_items")
      .update({ status: "removed" })
      .in("id", [...removed]);
  }
  await db.from("campaigns").update({ status: "outreach" }).eq("id", campaignId);

  if (pendingDrafts.length > 0) {
    const { draftInvite } = await import("@/lib/ai/invites");
    const bodies = await Promise.all(
      pendingDrafts.map((d) => draftInvite(d.input)),
    );
    await db.from("deal_messages").insert(
      pendingDrafts.map((d, i) => ({
        deal_id: d.dealId,
        direction: "outbound",
        channel: d.channel,
        ai_draft: true,
        body: bodies[i].body,
      })),
    );
  }

  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/outreach");
  revalidatePath("/");

  return {
    ok: true,
    message:
      `${created} invite${created === 1 ? "" : "s"} drafted and waiting for your approval in Outreach.` +
      (skippedDetail.length ? ` ${describeSkips(skippedDetail)}` : ""),
  };
}

/**
 * Why creators were left out, in words an agency can act on.
 *
 * Grouped by reason and naming the handles, because the only useful version of
 * "4 were skipped" says which four and what to do about it.
 */
function describeSkips(
  skips: { handle: string; reason: string; availableFrom: string | null }[],
): string {
  if (skips.length === 0) return "";

  const parts: string[] = [];
  const by = (reason: string) => skips.filter((s) => s.reason === reason);

  const names = (list: typeof skips) =>
    list.map((s) => `@${s.handle}`).join(", ");

  const optedOut = by("opted_out");
  if (optedOut.length) {
    parts.push(`${names(optedOut)} opted out of being contacted.`);
  }

  const limited = by("rate_limited");
  if (limited.length) {
    // The date is the point: "try again later" is not a plan.
    const soonest = limited
      .map((s) => s.availableFrom)
      .filter((d): d is string => Boolean(d))
      .sort()[0];
    parts.push(
      `${names(limited)} ${limited.length === 1 ? "was" : "were"} contacted in the last ${UNSOLICITED_COOLDOWN_DAYS} days` +
        (soonest ? `, so they can be approached again from ${formatDate(soonest)}.` : "."),
    );
  }

  const noChannel = by("no_channel");
  if (noChannel.length) {
    parts.push(
      `${names(noChannel)} ${noChannel.length === 1 ? "has" : "have"} no email address on file${
        integrations.resend ? "" : " and email is not configured on this deployment"
      }.`,
    );
  }

  const other = skips.filter(
    (s) => !["opted_out", "rate_limited", "no_channel"].includes(s.reason),
  );
  if (other.length) parts.push(`${names(other)} could not be contacted.`);

  return parts.join(" ");
}

/* ==========================================================================
   Outreach
   ========================================================================== */

/** Approves a drafted message and sends it, honouring DRY_RUN and the caps. */
export async function approveMessage(
  messageId: string,
  /**
   * The text as the approver left it.
   *
   * Editing before sending is the point of the queue — an AI draft that cannot
   * be corrected is a draft you have to discard and rewrite elsewhere. When
   * given, this is saved before sending, so what went out and what is on the
   * record are the same words.
   */
  editedBody?: string,
): Promise<ActionResult> {
  const db = requireServiceClient();
  const user = await getCurrentUser();

  if (editedBody?.trim()) {
    await db
      .from("deal_messages")
      .update({ body: editedBody.trim() })
      .eq("id", messageId)
      .is("sent_at", null);
  }

  const { data: message } = await db
    .from("deal_messages")
    .select("*, deals(creator_id)")
    .eq("id", messageId)
    .single();
  if (!message) return { ok: false, message: "That message is no longer here." };
  if (message.sent_at) return { ok: false, message: "That message has already been sent." };

  const creatorId = (message.deals as { creator_id: string }).creator_id;
  const { data: creator } = await db
    .from("creators")
    .select("phone, email, whatsapp_opt_in, do_not_contact, last_contacted_at, display_name")
    .eq("id", creatorId)
    .single();
  if (!creator) return { ok: false, message: "That creator is no longer here." };

  // On email the approved text becomes the body of a designed template rather
  // than going out as bare text. The reader has been scammed before, and a
  // wall of unformatted text from an unknown sender is exactly what a scam
  // looks like — the template puts the fee and the escrow badge up front.
  let body = message.body as string;
  let subject: string | undefined;
  let text: string | undefined;

  if (message.channel === "email") {
    const { data: deal } = await db
      .from("deals")
      .select("fee_kobo, invite_token, deadline, campaigns(end_brand_name)")
      .eq("id", message.deal_id)
      .maybeSingle();

    if (deal) {
      const { inviteEmail } = await import("@/lib/messaging/email-templates");
      const { creatorUrl } = await import("@/lib/domains");
      const campaign = one(deal.campaigns);
      const mail = inviteEmail({
        creatorFirstName: String(creator.display_name ?? "there").split(" ")[0],
        brandName: (campaign?.end_brand_name as string) ?? "A brand",
        deliverable: "1 video",
        feeKobo: Number(deal.fee_kobo),
        deadline: deal.deadline ? formatDate(deal.deadline as string) : "the agreed date",
        inviteUrl: creatorUrl(`/i/${deal.invite_token}`),
      });
      body = mail.html;
      subject = mail.subject;
      // The approved wording is what the creator reads in a plain-text client,
      // so the person who approved it is still the author of what goes out.
      text = message.body as string;
    }
  }

  const { sendMessage } = await import("@/lib/messaging/send");
  const outcome = await sendMessage(
    {
      dealId: message.deal_id,
      channel: message.channel,
      body,
      subject,
      text,
      to: { phone: creator.phone, email: creator.email },
      aiDraft: message.ai_draft,
      approvedBy: user.userId,
    },
    {
      doNotContact: creator.do_not_contact,
      lastUnsolicitedAt: creator.last_contacted_at,
      phone: creator.phone,
      email: creator.email,
      whatsappOptIn: creator.whatsapp_opt_in,
    },
  );

  if (!outcome.sent) {
    return { ok: false, message: outcome.detail };
  }

  await db
    .from("deal_messages")
    .update({
      approved_by: user.userId,
      sent_at: new Date().toISOString(),
      provider_message_id: outcome.providerMessageId,
      ai_draft: false,
    })
    .eq("id", messageId);

  await db
    .from("creators")
    .update({ last_contacted_at: new Date().toISOString() })
    .eq("id", creatorId);

  await db.from("contact_log").insert({
    creator_id: creatorId,
    deal_id: message.deal_id,
    channel: message.channel,
    unsolicited: true,
  });

  revalidatePath("/outreach");
  revalidatePath("/");

  return {
    ok: true,
    message: outcome.dryRun
      ? `Approved. DRY_RUN is on, so it was logged instead of sent to ${creator.display_name}.`
      : `Sent to ${creator.display_name}.`,
  };
}

/* ==========================================================================
   Content
   ========================================================================== */

/** Approves a draft and releases the creator's fee from escrow. */
export async function approveDraft(
  draftId: string,
  notes?: string,
): Promise<ActionResult> {
  const db = requireServiceClient();
  const user = await getCurrentUser();

  const { data: draft } = await db
    .from("drafts")
    .select("id, deal_id, version")
    .eq("id", draftId)
    .single();
  if (!draft) return { ok: false, message: "That draft is no longer here." };

  await db
    .from("drafts")
    .update({
      reviewer_decision: "approved",
      reviewer_notes: notes ?? null,
      reviewed_by: user.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", draftId);

  // Approving the content is not the same as the content being live. The deal
  // moves to approved; the money moves when a published URL is verified.
  await db.from("deals").update({ status: "approved" }).eq("id", draft.deal_id);

  revalidatePath(`/deals/${draft.deal_id}`);
  revalidatePath("/");

  return {
    ok: true,
    message: "Approved. The creator can publish now — payment releases once the post is verified live.",
  };
}

export async function requestRevision(
  draftId: string,
  notes: string,
): Promise<ActionResult> {
  if (!notes.trim()) {
    return {
      ok: false,
      message: "Say what needs to change — the creator receives this word for word.",
    };
  }

  const db = requireServiceClient();
  const user = await getCurrentUser();

  const { data: draft } = await db
    .from("drafts")
    .select("id, deal_id")
    .eq("id", draftId)
    .single();
  if (!draft) return { ok: false, message: "That draft is no longer here." };

  await db
    .from("drafts")
    .update({
      reviewer_decision: "revision",
      reviewer_notes: notes,
      reviewed_by: user.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", draftId);

  await db
    .from("deals")
    .update({ status: "revision_requested" })
    .eq("id", draft.deal_id);

  await db.from("deal_messages").insert({
    deal_id: draft.deal_id,
    direction: "outbound",
    channel: "whatsapp",
    ai_draft: true,
    body: notes,
  });

  revalidatePath(`/deals/${draft.deal_id}`);
  revalidatePath("/outreach");

  return {
    ok: true,
    message: "Sent back with your note. It is queued in Outreach for you to approve before it reaches them.",
  };
}

/**
 * Confirms a post is live, which is what actually releases the money.
 *
 * Verification is a person clicking after seeing the post, not an automated
 * scrape — v1 does not read post metrics, and paying out on an unverified claim
 * is exactly the failure escrow exists to prevent.
 */
export async function verifyPublished(dealId: string): Promise<ActionResult> {
  const db = requireServiceClient();
  const user = await getCurrentUser();

  const { data: deal } = await db
    .from("deals")
    .select("id, published_url, status, fee_kobo")
    .eq("id", dealId)
    .single();
  if (!deal) return { ok: false, message: "That deal is no longer here." };
  if (!deal.published_url) {
    return {
      ok: false,
      message: "The creator has not added the published link yet.",
    };
  }
  if (deal.status === "paid") {
    return { ok: false, message: "This one has already been released." };
  }

  try {
    const { releasedKobo } = await releaseDeal(dealId, {
      memo: "Released on verified publish",
      releasedBy: user.userId,
    });

    revalidatePath(`/deals/${dealId}`);
    revalidatePath("/wallet");
    revalidatePath("/");

    return {
      ok: true,
      message: `${formatNaira(releasedKobo)} released. The payout is queued and lands within 24 hours.`,
    };
  } catch (error) {
    if (error instanceof InsufficientFunds) {
      return {
        ok: false,
        message: `This campaign's escrow holds ${formatNaira(error.availableKobo)} but ${formatNaira(error.requiredKobo)} is needed. Add funds before releasing.`,
      };
    }
    return { ok: false, message: (error as Error).message };
  }
}

/* ==========================================================================
   Creating a campaign
   ========================================================================== */

export interface NewCampaignInput {
  spaceId: string;
  name: string;
  product: string;
  objective: string;
  category: string;
  keyMessages: string[];
  mustAvoid: string[];
  disclosureTag: string;
  usageRightsDays: number;
  deadline: string | null;
  slots: { type: string; count: number; feeKobo: number }[];
  /** Draft campaigns are saved and left alone; created ones are ready to fund. */
  asDraft: boolean;
}

/**
 * Creates a campaign and its deliverables.
 *
 * Nothing is funded and nobody is contacted here — creating a campaign is
 * writing down what you want, and the money is a separate, deliberate step. So
 * this succeeds even when the wallet is empty, which is the normal case: most
 * agencies write the brief while waiting for the client's transfer to land.
 */
export async function createCampaign(
  input: NewCampaignInput,
): Promise<ActionResult & { campaignId?: string }> {
  const name = input.name.trim();
  if (!name) {
    return { ok: false, message: "Give the campaign a name." };
  }
  if (!input.spaceId) {
    return { ok: false, message: "Choose which client this is for." };
  }

  const slots = input.slots.filter((s) => s.count > 0 && s.feeKobo > 0);
  if (slots.length === 0 && !input.asDraft) {
    return {
      ok: false,
      message: "Add at least one deliverable with a fee before creating it.",
    };
  }

  const org = await getCurrentOrg();
  const db = requireServiceClient();

  const { data: space } = await db
    .from("spaces")
    .select("id, name, org_id")
    .eq("id", input.spaceId)
    .maybeSingle();

  // Belt and braces alongside RLS: a space id from another org must not be
  // usable just because it was posted in a form field.
  if (!space || space.org_id !== org.id) {
    return { ok: false, message: "That client is not on your account." };
  }

  const creatorFees = slots.reduce((sum, s) => sum + s.feeKobo * s.count, 0);
  const fees = slots.map((s) => s.feeKobo).filter((f) => f > 0);

  const { data: campaign, error } = await db
    .from("campaigns")
    .insert({
      space_id: space.id,
      org_id: org.id,
      name,
      end_brand_name: space.name,
      status: "draft",
      budget_kobo: creatorFees > 0 ? fundingRequiredFor(creatorFees, 1200) : 0,
      platform_fee_bps: 1200,
      agency_margin_bps: org.type === "agency" ? org.defaultMarginBps : null,
      arcon_category: input.category,
      brief: {
        objective: input.objective,
        product: input.product.trim(),
        key_messages: input.keyMessages.filter(Boolean),
        must_include: input.keyMessages.filter(Boolean),
        must_avoid: input.mustAvoid.filter(Boolean),
        audience: { cities: [], languages: ["English"] },
        platforms: [...new Set(slots.map((s) => s.type.split("_")[0]))],
        tone: "",
        disclosure_tag: input.disclosureTag.trim() || "#ad",
        arcon_category: input.category,
        usage_rights_days: input.usageRightsDays,
      },
      // The band the AI negotiates inside: never above what was budgeted, and
      // not so far below it that every offer insults the creator.
      rate_band_min_kobo: fees.length ? Math.round(Math.min(...fees) * 0.6) : 0,
      rate_band_max_kobo: fees.length ? Math.max(...fees) : 0,
      deadline: input.deadline,
    })
    .select("id")
    .single();

  if (error || !campaign) {
    return {
      ok: false,
      message: error?.message ?? "Could not create the campaign.",
    };
  }

  if (slots.length > 0) {
    const { error: slotError } = await db.from("campaign_slots").insert(
      slots.map((s) => ({
        campaign_id: campaign.id,
        deliverable_type: s.type,
        count: s.count,
        fee_kobo: s.feeKobo,
      })),
    );
    if (slotError) {
      // A campaign with no deliverables cannot be funded or shortlisted, so it
      // is worse than no campaign at all.
      await db.from("campaigns").delete().eq("id", campaign.id);
      return { ok: false, message: slotError.message };
    }
  }

  revalidatePath("/campaigns");
  revalidatePath("/");

  return {
    ok: true,
    campaignId: campaign.id,
    message: input.asDraft
      ? "Saved as a draft. Nothing is funded and nobody has been contacted."
      : "Campaign created. Fund it when you are ready — nobody is contacted until then.",
  };
}

/* ==========================================================================
   AI shortlist
   ========================================================================== */

/**
 * Asks the model to rank creators for a campaign.
 *
 * Writes suggestions and nothing else — every one still has to be approved by a
 * person before a creator hears from us. Slow enough to be worth a spinner: the
 * model reads sixty profiles, which takes a few seconds.
 */
export async function runShortlist(
  campaignId: string,
): Promise<ActionResult & { live?: boolean }> {
  try {
    const { generateShortlist } = await import("@/lib/ai/shortlist");
    const result = await generateShortlist(campaignId);

    revalidatePath(`/campaigns/${campaignId}/shortlist`);
    revalidatePath(`/campaigns/${campaignId}`);

    const note = result.live
      ? ""
      : " (ranked without AI — no model is configured, so this is ordered by fraud score alone)";

    return {
      ok: true,
      live: result.live,
      message: `${result.created} creator${result.created === 1 ? "" : "s"} suggested${note}. Nobody has been contacted — approve the ones you want first.`,
    };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}

/**
 * Throwing away an AI draft that should not be sent.
 *
 * Deleted rather than kept as a rejected row: an unsent draft is not a fact
 * about the creator, it is a suggestion nobody accepted, and leaving it in the
 * thread makes the history harder to read for no gain. A sent message is never
 * touched by this.
 */
export async function discardMessage(messageId: string): Promise<ActionResult> {
  const db = requireServiceClient();

  const { data: message } = await db
    .from("deal_messages")
    .select("id, deal_id, sent_at, ai_draft, deals(campaign_id)")
    .eq("id", messageId)
    .single();

  if (!message) return { ok: false, message: "That message is no longer here." };
  if (message.sent_at) {
    return {
      ok: false,
      message: "That message has already been sent, so it cannot be discarded.",
    };
  }

  await db.from("deal_messages").delete().eq("id", messageId).is("sent_at", null);

  const campaignId = one(message.deals)?.campaign_id as string | undefined;
  if (campaignId) revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/outreach");

  return { ok: true, message: "Discarded. Nothing was sent." };
}

/* ==========================================================================
   Cancelling
   ========================================================================== */

/** Deal states that mean a creator has committed and is owed a decision. */
const COMMITTED_DEAL_STATES = [
  "accepted",
  "contract_signed",
  "draft_submitted",
  "revision_requested",
  "approved",
  "published",
  "paid",
  "disputed",
];

/**
 * What cancelling this campaign would do, without doing it.
 *
 * The screen needs to state the consequence before the button is pressed —
 * how much comes back and who gets told — and refusing at the point of the
 * click is far too late when the answer is "you cannot, three creators have
 * already signed".
 */
export async function previewCancelCampaign(campaignId: string): Promise<{
  canCancel: boolean;
  refundKobo: number;
  invitedCount: number;
  committedCount: number;
  reason: string | null;
}> {
  const db = requireServiceClient();

  const { data: campaign } = await db
    .from("campaigns")
    .select("id, org_id, space_id, status")
    .eq("id", campaignId)
    .maybeSingle();

  if (!campaign) {
    return {
      canCancel: false,
      refundKobo: 0,
      invitedCount: 0,
      committedCount: 0,
      reason: "That campaign no longer exists.",
    };
  }

  const { data: deals } = await db
    .from("deals")
    .select("id, status")
    .eq("campaign_id", campaignId);

  const committed = (deals ?? []).filter((d) =>
    COMMITTED_DEAL_STATES.includes(d.status as string),
  );
  const invited = (deals ?? []).filter((d) => d.status === "invited");

  const escrow = await accountFor("campaign_escrow", {
    orgId: campaign.org_id,
    spaceId: campaign.space_id,
    campaignId: campaign.id,
  });
  const refundKobo = await balanceOf(escrow);

  if (campaign.status === "cancelled") {
    return {
      canCancel: false,
      refundKobo,
      invitedCount: invited.length,
      committedCount: committed.length,
      reason: "This campaign is already cancelled.",
    };
  }

  // A creator who has signed has arranged their week around this. Cancelling
  // out from under them is a dispute, not a refund, and it goes to a person.
  if (committed.length > 0) {
    return {
      canCancel: false,
      refundKobo,
      invitedCount: invited.length,
      committedCount: committed.length,
      reason: `${committed.length} creator${committed.length === 1 ? " has" : "s have"} already accepted this campaign. Cancel their individual deals first, or contact support — money owed to a creator who has started work is not ours to take back.`,
    };
  }

  return {
    canCancel: true,
    refundKobo,
    invitedCount: invited.length,
    committedCount: 0,
    reason: null,
  };
}

/**
 * Cancels a campaign and returns the escrow to the client's wallet.
 *
 * Escrowed money is the client's throughout — it is held, not taken — so a
 * campaign that never started must be able to give it back. Without this,
 * funding was a one-way door, which is precisely the thing an agency fears
 * about putting a client's budget into somebody else's platform.
 *
 * Only campaigns nobody has committed to. The check is repeated here rather
 * than trusted from the preview, because the two calls are seconds apart and a
 * creator can accept in between.
 */
export async function cancelCampaign(
  campaignId: string,
  reason: string,
): Promise<ActionResult> {
  if (!reason.trim()) {
    return {
      ok: false,
      message: "Say why this is being cancelled — it goes on the record and the invited creators are told.",
    };
  }

  const db = requireServiceClient();
  const user = await getCurrentUser();

  const preview = await previewCancelCampaign(campaignId);
  if (!preview.canCancel) {
    return { ok: false, message: preview.reason ?? "This campaign cannot be cancelled." };
  }

  const { data: campaign } = await db
    .from("campaigns")
    .select("id, name, org_id, space_id")
    .eq("id", campaignId)
    .single();
  if (!campaign) return { ok: false, message: "That campaign no longer exists." };

  try {
    if (preview.refundKobo > 0) {
      const escrow = await accountFor("campaign_escrow", {
        orgId: campaign.org_id,
        spaceId: campaign.space_id,
        campaignId: campaign.id,
      });
      const wallet = await accountFor("space_wallet", {
        orgId: campaign.org_id,
        spaceId: campaign.space_id,
      });

      await post(
        buildRefund({
          escrowAccountId: escrow,
          destinationAccountId: wallet,
          amountKobo: preview.refundKobo,
          memo: `Cancelled ${campaign.name} — escrow returned`,
        }),
        { createdBy: user.userId },
      );
    }

    // Invited creators are told, and their deals closed. An invite left open on
    // a cancelled campaign is how somebody does work nobody will pay for.
    await db
      .from("deals")
      .update({ status: "cancelled" })
      .eq("campaign_id", campaignId)
      .eq("status", "invited");

    // Unsent drafts for those invites are pointless now.
    const { data: openDeals } = await db
      .from("deals")
      .select("id")
      .eq("campaign_id", campaignId);
    const dealIds = (openDeals ?? []).map((d) => d.id);
    if (dealIds.length) {
      await db
        .from("deal_messages")
        .delete()
        .in("deal_id", dealIds)
        .is("sent_at", null);
    }

    await db
      .from("shortlist_items")
      .delete()
      .eq("campaign_id", campaignId)
      .eq("status", "proposed");

    await db
      .from("campaigns")
      .update({ status: "cancelled" })
      .eq("id", campaignId);

    revalidatePath(`/campaigns/${campaignId}`);
    revalidatePath("/campaigns");
    revalidatePath("/wallet");
    revalidatePath("/");

    return {
      ok: true,
      message:
        preview.refundKobo > 0
          ? `Cancelled. ${formatNaira(preview.refundKobo)} is back in the client's wallet and available to spend.`
          : "Cancelled. There was nothing in escrow to return.",
    };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}

/* ==========================================================================
   Clients
   ========================================================================== */

/**
 * Adds a client space.
 *
 * A space is the unit of separation in this product: its own wallet, its own
 * campaigns, and a wall between one client's money and another's. An agency
 * that cannot add their second client cannot use the platform at all, and the
 * button to do it did nothing.
 */
export async function createSpace(
  name: string,
  category: string,
): Promise<ActionResult> {
  const trimmed = name.trim();
  if (!trimmed) {
    return { ok: false, message: "Give the client a name." };
  }

  const org = await getCurrentOrg();
  const db = requireServiceClient();

  // Two spaces with the same name in one agency is a mistake waiting to become
  // a payment to the wrong wallet.
  const { data: clash } = await db
    .from("spaces")
    .select("id")
    .eq("org_id", org.id)
    .ilike("name", trimmed)
    .maybeSingle();

  if (clash) {
    return { ok: false, message: `You already have a client called ${trimmed}.` };
  }

  const { error } = await db.from("spaces").insert({
    org_id: org.id,
    name: trimmed,
    category: category.trim() || null,
  });

  if (error) {
    return { ok: false, message: `Could not add that client: ${error.message}` };
  }

  revalidatePath("/spaces");
  revalidatePath("/wallet");
  revalidatePath("/campaigns/new");

  return {
    ok: true,
    message: `${trimmed} added. They have their own wallet, starting empty.`,
  };
}

/* ==========================================================================
   Account settings
   ========================================================================== */

/**
 * Saves the agency's own details.
 *
 * The registered name and CAC number are what appear on a creator's contract,
 * so this is not cosmetic — a contract naming the wrong entity is harder to
 * enforce. Only an owner or admin may change them.
 */
export async function updateOrgSettings(input: {
  name: string;
  cacNumber: string;
  defaultMarginBps?: number;
}): Promise<ActionResult> {
  const [org, member] = await Promise.all([getCurrentOrg(), getCurrentUser()]);

  if (member.role !== "owner" && member.role !== "admin") {
    return {
      ok: false,
      message: "Only an owner or an admin can change the account details.",
    };
  }

  const name = input.name.trim();
  if (!name) return { ok: false, message: "The registered name cannot be empty." };

  const patch: Record<string, unknown> = {
    name,
    cac_number: input.cacNumber.trim() || null,
  };

  if (input.defaultMarginBps !== undefined) {
    if (
      !Number.isInteger(input.defaultMarginBps) ||
      input.defaultMarginBps < 0 ||
      input.defaultMarginBps > 10_000
    ) {
      return { ok: false, message: "That margin is not a valid percentage." };
    }
    patch.default_margin_bps = input.defaultMarginBps;
  }

  const { error } = await requireServiceClient()
    .from("orgs")
    .update(patch)
    .eq("id", org.id);

  if (error) {
    return { ok: false, message: `Could not save: ${error.message}` };
  }

  revalidatePath("/settings");
  revalidatePath("/");

  return { ok: true, message: "Saved." };
}

/* ==========================================================================
   Team
   ========================================================================== */

/**
 * Inviting a colleague into the agency account.
 *
 * Until this existed, the only way into an org was to create it — so the second
 * person at an agency simply could not get in. The invite is a random token
 * tied to one email address; accepting it while signed in as somebody else is
 * refused, so a forwarded invite cannot add a stranger to the account.
 *
 * Re-inviting the same address replaces the outstanding invite rather than
 * failing, because "I'll send it again" is what a person actually does when an
 * email goes missing.
 */
export async function inviteTeammate(
  email: string,
  role: "admin" | "member",
): Promise<ActionResult> {
  const [org, member] = await Promise.all([getCurrentOrg(), getCurrentUser()]);

  if (member.role !== "owner" && member.role !== "admin") {
    return { ok: false, message: "Only an owner or an admin can invite people." };
  }

  const address = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
    return { ok: false, message: "That does not look like an email address." };
  }

  const db = requireServiceClient();

  // Already on the team is not a failure worth an error message about tokens.
  const { data: existing } = await db
    .from("org_members")
    .select("id, users:user_id(email)")
    .eq("org_id", org.id);

  const alreadyIn = (existing ?? []).some(
    (m) => (one(m.users) as { email?: string } | undefined)?.email?.toLowerCase() === address,
  );
  if (alreadyIn) {
    return { ok: false, message: `${address} is already on this account.` };
  }

  await db.from("org_invites").delete().eq("org_id", org.id).eq("email", address);

  const { data: invite, error } = await db
    .from("org_invites")
    .insert({
      org_id: org.id,
      email: address,
      role,
      invited_by: member.userId,
    })
    .select("token")
    .single();

  if (error || !invite) {
    return {
      ok: false,
      message: `Could not create that invitation: ${error?.message ?? "unknown error"}`,
    };
  }

  const link = `${env.NEXT_PUBLIC_APP_URL}/join/${invite.token}`;

  const { sendTransactional } = await import("@/lib/messaging/send");
  const outcome = await sendTransactional({
    channel: "email",
    to: { email: address },
    subject: `${member.name} invited you to ${org.name} on SubSquad`,
    body: [
      `${member.name} has invited you to join ${org.name} on SubSquad as ${role === "admin" ? "an admin" : "a member"}.`,
      "",
      `Accept here: ${link}`,
      "",
      "This link expires in seven days and works once.",
      "",
      "If you were not expecting this, ignore it — nothing happens until you accept.",
    ].join("\n"),
    label: `org invite to ${address}`,
  });

  revalidatePath("/settings");

  return {
    ok: true,
    message: outcome.sent
      ? `Invitation sent to ${address}. It expires in seven days.`
      : `Invitation created for ${address}, but the email could not be sent. Share this link with them directly: ${link}`,
  };
}

/** Withdrawing an invitation that has not been accepted. */
export async function revokeInvite(inviteId: string): Promise<ActionResult> {
  const [org, member] = await Promise.all([getCurrentOrg(), getCurrentUser()]);
  if (member.role !== "owner" && member.role !== "admin") {
    return { ok: false, message: "Only an owner or an admin can do that." };
  }

  await requireServiceClient()
    .from("org_invites")
    .delete()
    .eq("id", inviteId)
    .eq("org_id", org.id)
    .is("accepted_at", null);

  revalidatePath("/settings");
  return { ok: true, message: "Invitation withdrawn." };
}
