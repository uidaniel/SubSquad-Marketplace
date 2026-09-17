import "server-only";

import { requireServiceClient } from "@/lib/supabase/service";
import { one } from "@/lib/data/relations";
import { callModel } from "./client";
import { contentReviewSchema, type ContentReviewOutput } from "./schemas";
import {
  CONTENT_REVIEW_VERSION,
  contentReviewSystemPrompt,
  contentReviewUserPrompt,
} from "./prompts/content-review";
import { sendTransactional } from "@/lib/messaging/send";
import { revisionEmail } from "@/lib/messaging/email-templates";
import { creatorUrl } from "@/lib/domains";
import { toBrief } from "@/lib/data/brief";

/**
 * Reviewing a draft against its brief.
 *
 * This is the promise the product is sold on — "bad drafts never reach you" —
 * and the part where getting it wrong costs a real person real money. So the
 * rules it follows are deliberately conservative:
 *
 *   · A failing review never reaches the brand. The creator gets the fix list
 *     privately and resubmits, which is what makes the promise true from both
 *     sides: the brand only sees work that already meets the brief, and the
 *     creator is not publicly marked down for a first draft.
 *
 *   · Two strikes and a person looks. After two attempts the draft goes to the
 *     org whatever the model thinks — either the creator cannot satisfy it or
 *     the model is wrong about the brief, and both need a human, not a third
 *     identical rejection.
 *
 *   · Without an API key the draft passes to the org with the review marked as
 *     not run. Silently holding somebody's work because an integration is
 *     unconfigured is the worse failure.
 */

const MAX_AUTOMATED_ATTEMPTS = 2;

export interface ReviewResult {
  passes: boolean;
  /** True when the org can now see it: it passed, or a person is needed. */
  visibleToOrg: boolean;
  review: ContentReviewOutput;
  live: boolean;
  attemptNumber: number;
}

export class ReviewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewError";
  }
}

export async function reviewDraft(draftId: string): Promise<ReviewResult> {
  const db = requireServiceClient();

  const { data: draft } = await db
    .from("drafts")
    .select(
      "id, deal_id, version, caption, transcript, frame_descriptions, deals(id, creator_id, fee_kobo, campaign_id, campaigns(brief, end_brand_name), creators(display_name, phone, email, whatsapp_opt_in, do_not_contact))",
    )
    .eq("id", draftId)
    .maybeSingle();

  if (!draft) throw new ReviewError("That draft no longer exists.");

  const deal = one(draft.deals);
  if (!deal) throw new ReviewError("That draft is not attached to a deal.");

  const campaign = one(deal.campaigns);
  const creator = one(deal.creators);
  const brief = toBrief(campaign?.brief);

  const attemptNumber = Number(draft.version);
  const frames = Array.isArray(draft.frame_descriptions)
    ? (draft.frame_descriptions as string[])
    : [];

  // What the creator was last told, so the model does not send them back for
  // something they have already fixed.
  const { data: previous } = await db
    .from("drafts")
    .select("ai_review")
    .eq("deal_id", draft.deal_id)
    .lt("version", attemptNumber)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const previousFeedback =
    (previous?.ai_review as ContentReviewOutput | null)?.creatorFeedback ?? null;

  const result = await callModel(
    {
      purpose: "content_review",
      campaignId: (deal.campaign_id as string) ?? null,
      dealId: deal.id as string,
      creatorId: deal.creator_id as string,
      promptVersion: CONTENT_REVIEW_VERSION,
    },
    {
      system: contentReviewSystemPrompt(),
      user: contentReviewUserPrompt({
        brief,
        caption: (draft.caption as string) ?? "",
        transcript: (draft.transcript as string) ?? null,
        frameDescriptions: frames,
        attemptNumber,
        previousFeedback,
      }),
      schema: contentReviewSchema,
      // No model configured: pass it through to the org rather than hold the
      // creator's work hostage to an unconfigured integration, and say plainly
      // that nothing was checked so nobody mistakes it for a clean review.
      stub: {
        passes: true,
        checks: [
          {
            id: "not_reviewed",
            label: "Not checked — no AI is configured on this deployment",
            status: "unclear" as const,
            evidence: "Review this draft against the brief yourself.",
          },
        ],
        riskFlags: [],
        creatorFeedback: "Thanks — your draft is with the brand now.",
      },
    },
  );

  const review = result.data;

  // A failing review is the creator's business until they have had two goes at
  // it. After that a person decides, whatever the model says.
  const exhaustedAttempts = attemptNumber >= MAX_AUTOMATED_ATTEMPTS;
  const visibleToOrg = review.passes || exhaustedAttempts;

  await db
    .from("drafts")
    .update({ ai_review: review })
    .eq("id", draftId);

  await db
    .from("deals")
    .update({
      status: visibleToOrg ? "draft_submitted" : "revision_requested",
    })
    .eq("id", draft.deal_id);

  if (!visibleToOrg && creator) {
    await tellCreator({
      creator,
      dealId: draft.deal_id as string,
      brandName: (campaign?.end_brand_name as string) ?? "the brand",
      feeKobo: Number(deal.fee_kobo),
      feedback: review.creatorFeedback,
    });
  }

  return {
    passes: review.passes,
    visibleToOrg,
    review,
    live: result.live,
    attemptNumber,
  };
}

/**
 * Sends the fix list.
 *
 * Transactional rather than outreach: the creator submitted work minutes ago
 * and is waiting to hear back, so the once-a-week unsolicited cap has no
 * business applying. A creator left guessing why their draft went quiet is how
 * a deadline gets missed.
 */
async function tellCreator(args: {
  creator: Record<string, unknown>;
  dealId: string;
  brandName: string;
  feeKobo: number;
  feedback: string;
}) {
  const db = requireServiceClient();
  const firstName = String(args.creator.display_name ?? "there").split(" ")[0];
  const dealUrl = creatorUrl(`/deals/${args.dealId}`);

  const phone = args.creator.phone as string | null;
  const email = args.creator.email as string | null;
  const channel = phone ? "whatsapp" : email ? "email" : null;

  if (!channel) return;

  const mail = revisionEmail({
    creatorFirstName: firstName,
    brandName: args.brandName,
    feeKobo: args.feeKobo,
    notes: args.feedback,
    dealUrl,
  });

  const outcome = await sendTransactional({
    channel,
    to: { phone, email },
    subject: mail.subject,
    label: `revision request for deal ${args.dealId}`,
    body: channel === "whatsapp" ? `${args.feedback}\n\n${dealUrl}` : mail.html,
  });

  // Recorded on the thread whether or not it sent, so the agency can see what
  // the creator was told — and ops can see when nothing reached them.
  await db.from("deal_messages").insert({
    deal_id: args.dealId,
    direction: "outbound",
    channel,
    body: args.feedback,
    ai_draft: false,
    sent_at: outcome.sent ? new Date().toISOString() : null,
    provider_message_id: outcome.sent ? outcome.providerMessageId : null,
  });
}
