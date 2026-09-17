"use server";

import { revalidatePath } from "next/cache";
import { requireServiceClient } from "@/lib/supabase/service";
import { accountFor, balanceOf, InsufficientFunds, post } from "@/lib/ledger/post";
import { buildDeposit, buildLock, fundingRequiredFor } from "@/lib/ledger/transactions";
import { releaseDeal } from "@/lib/deals/release";
import { checkSendAllowed } from "@/lib/messaging/policy";
import { getCurrentOrg, getCurrentUser } from "@/lib/data/queries";
import { formatNaira, parseNairaInput } from "@/lib/money";
import { creatorUrl } from "@/lib/domains";
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

  const { data: items } = await db
    .from("shortlist_items")
    .select("*, creators(id, display_name, handle, phone, email, whatsapp_opt_in, do_not_contact, last_contacted_at)")
    .eq("campaign_id", campaignId)
    .eq("status", "proposed");

  if (!items?.length) {
    return { ok: false, message: "There is nothing left to approve on this shortlist." };
  }

  const removed = new Set(removedItemIds);
  const approved = items.filter((i) => !removed.has(i.id));

  if (approved.length === 0) {
    return { ok: false, message: "Every creator was removed, so there is nothing to send." };
  }

  const { data: campaign } = await db
    .from("campaigns")
    .select("id, name, end_brand_name, deadline")
    .eq("id", campaignId)
    .single();

  let created = 0;
  let skipped = 0;

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
    const allowed = checkSendAllowed(
      {
        doNotContact: creator.do_not_contact,
        lastUnsolicitedAt: creator.last_contacted_at,
        phone: creator.phone,
        email: creator.email,
        whatsappOptIn: creator.whatsapp_opt_in,
      },
      {},
    );
    if (!allowed.allowed) {
      skipped += 1;
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
      channel: creator.phone ? "whatsapp" : "email",
      input: {
        creatorFirstName: creator.display_name.split(" ")[0],
        creatorHandle: creator.handle ?? creator.display_name,
        brandName: campaign?.end_brand_name ?? "A brand",
        deliverable: "1 video",
        feeKobo: Number(item.estimated_fee_kobo),
        deadline: (campaign?.deadline as string) ?? null,
        inviteUrl: creatorUrl(`/i/${deal.invite_token}`),
        channel: (creator.phone ? "whatsapp" : "email") as "whatsapp" | "email",
      },
    });

    created += 1;
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
      (skipped
        ? ` ${skipped} creator${skipped === 1 ? " was" : "s were"} skipped — opted out, or contacted in the last week.`
        : ""),
  };
}

/* ==========================================================================
   Outreach
   ========================================================================== */

/** Approves a drafted message and sends it, honouring DRY_RUN and the caps. */
export async function approveMessage(messageId: string): Promise<ActionResult> {
  const db = requireServiceClient();
  const user = await getCurrentUser();

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
