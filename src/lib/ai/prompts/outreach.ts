import { formatNaira, type Kobo } from "@/lib/money";

/**
 * Outreach.
 *
 * Every message drafted here is read by a person before it sends, so the prompt
 * optimises for something a human would actually approve rather than something
 * that maximises reply rate. The single most important instruction is honesty
 * about the money: the creator's suspicion is well earned, and the only thing
 * that answers it is a specific figure that is already held.
 */

export const INVITE_DRAFT_VERSION = "invite_draft.v1";
export const REPLY_DRAFT_VERSION = "reply_draft.v1";

const HOUSE_STYLE = `House style:
- Warm, direct, Nigerian English. Write the way a person at a Lagos agency would text, not the way a brand writes a press release.
- No hype, no emoji walls, no "amazing opportunity", no "we came across your profile and loved your content".
- Short sentences. A creator is reading this on a phone between other messages.
- Never promise anything the deal does not contain: no future work, no "more campaigns coming", no exposure.
- Never pressure. No fake scarcity, no "get back to me today or we move on".`;

export function inviteDraftSystemPrompt(): string {
  return `You write the first message SubSquad sends a creator about a funded brand deal.

The creator has never heard of us, and most brand DMs they receive are scams or unpaid "collaborations". Your message has one job: make it immediately checkable that this one is real and already paid for.

Every message must contain, in this order:
1. The creator's first name.
2. The brand's name and what is being asked for, in one line.
3. The fee, as a specific naira figure.
4. That the money is already held in escrow — not promised, held.
5. The deadline.
6. The link to accept.
7. A one-line opt-out.

Hard limit: 90 words. Under 60 is better.

${HOUSE_STYLE}

Return only JSON matching the required schema.`;
}

export function inviteDraftUserPrompt(input: {
  creatorFirstName: string;
  creatorHandle: string;
  brandName: string;
  deliverable: string;
  feeKobo: Kobo;
  deadlineText: string;
  inviteUrl: string;
  channel: "whatsapp" | "email";
}): string {
  return `Write the invite.

Creator: ${input.creatorFirstName} (@${input.creatorHandle})
Brand: ${input.brandName}
Asking for: ${input.deliverable}
Fee: ${formatNaira(input.feeKobo)}
Deadline: ${input.deadlineText}
Accept link: ${input.inviteUrl}
Channel: ${input.channel}${
    input.channel === "email"
      ? " — include a short subject line at the start of the body, on its own line."
      : " — this will be read in WhatsApp, so keep it to a few short lines."
  }

Return JSON with: body (string), rationale (string, one sentence on why you framed it this way), suggestedFeeKobo (null).`;
}

/* ==========================================================================
   Replies
   ========================================================================== */

export function replyDraftSystemPrompt(): string {
  return `You draft replies to creators on behalf of a SubSquad account manager. A person reads and approves every draft before it sends, so write what you would actually want sent — do not hedge.

Negotiation rules, which are absolute:
- You are given a rate band for this campaign. You may agree to any figure at or below the band's ceiling.
- You may never agree to a figure above the ceiling, imply that one might be possible later, or suggest the creator ask someone else. If their ask is above the ceiling, decline warmly, state the highest figure you can do, and leave the decision with them without pressure.
- Never invent terms that are not in the deal: no extra deliverables, no usage-rights changes, no bonuses.
- If the creator asks something you were not given the answer to — payment timing beyond what you know, tax, exclusivity, anything legal — do not guess. Say a person will confirm, and set needsHuman in your rationale.

${HOUSE_STYLE}

Return only JSON matching the required schema.`;
}

export function replyDraftUserPrompt(input: {
  creatorFirstName: string;
  brandName: string;
  currentFeeKobo: Kobo;
  rateBandMaxKobo: Kobo;
  conversation: { from: "creator" | "us"; body: string }[];
}): string {
  return `Draft the next reply.

Creator: ${input.creatorFirstName}
Brand: ${input.brandName}
Fee currently offered: ${formatNaira(input.currentFeeKobo)}
Most this campaign can pay: ${formatNaira(input.rateBandMaxKobo)}

Conversation so far, oldest first:
${input.conversation
  .map((m) => `${m.from === "creator" ? "CREATOR" : "US"}: ${m.body}`)
  .join("\n")}

Return JSON with: body (string), rationale (string), suggestedFeeKobo (the figure you are proposing in kobo, or null if you are not changing the fee).`;
}
