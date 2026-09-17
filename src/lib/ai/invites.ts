import "server-only";

import { callModel } from "./client";
import { messageDraftSchema } from "./schemas";
import {
  INVITE_DRAFT_VERSION,
  inviteDraftSystemPrompt,
  inviteDraftUserPrompt,
} from "./prompts/outreach";
import { type Kobo } from "@/lib/money";
import { formatDate } from "@/lib/utils";

/**
 * Writing the invite.
 *
 * The single most important message the platform sends: it decides whether a
 * creator replies at all. A template gets the facts right, which is most of the
 * job — but the thing that makes a creator believe this one is real is a
 * sentence showing somebody actually watched their videos, and that is what a
 * model can write and a template cannot.
 *
 * Every draft still goes to the ops inbox for a person to approve before it
 * sends, so the model is writing a suggestion, not sending mail.
 */

export interface InviteDraftInput {
  creatorFirstName: string;
  creatorHandle: string;
  brandName: string;
  deliverable: string;
  /**
   * What the campaign has budgeted. Used to decide whether to say anything
   * about money at all — never printed.
   *
   * The first email used to name it: "₦68,000 is already held in escrow". Two
   * things wrong with that. It is the model's estimate, not an offer anybody
   * agreed, and it anchors a creator who might charge ₦120,000 to a number we
   * invented. What survives is the fact that matters — the money is real and
   * already held — without pricing their work for them.
   */
  feeKobo: Kobo;
  deadline: string | null;
  inviteUrl: string;
  channel: "whatsapp" | "email";
}

/**
 * The fallback, and the shape every draft has to hit.
 *
 * Used when no model is configured, and when one is configured but fails or is
 * slow — an invite that goes out reading slightly generic beats a campaign that
 * stalls because an API call timed out.
 */
export function templateInvite(input: InviteDraftInput): string {
  const due = input.deadline ? ` by ${formatDate(input.deadline)}` : "";
  return [
    `Hi ${input.creatorFirstName} — ${input.brandName} would like ${input.deliverable} from you${due}.`,
    ``,
    `The budget is already held in escrow, so the money is real before you start. You tell us your rate — we are not going to tell you what your work is worth.`,
    ``,
    input.inviteUrl,
    ``,
    `Not interested? Reply STOP and we will not message you again.`,
  ].join("\n");
}

/** How long to wait before falling back. Outreach must not hang on one model call. */
const DRAFT_TIMEOUT_MS = 12_000;

export async function draftInvite(input: InviteDraftInput): Promise<{
  body: string;
  live: boolean;
}> {
  const fallback = templateInvite(input);

  try {
    const result = await withTimeout(
      callModel(
        { purpose: "invite_draft", promptVersion: INVITE_DRAFT_VERSION },
        {
          system: inviteDraftSystemPrompt(),
          user: inviteDraftUserPrompt({
            creatorFirstName: input.creatorFirstName,
            creatorHandle: input.creatorHandle,
            brandName: input.brandName,
            deliverable: input.deliverable,
            feeKobo: input.feeKobo,
            deadlineText: input.deadline
              ? formatDate(input.deadline)
              : "no fixed date",
            inviteUrl: input.inviteUrl,
            channel: input.channel,
          }),
          schema: messageDraftSchema,
          stub: { body: fallback, suggestedFeeKobo: null },
        },
      ),
      DRAFT_TIMEOUT_MS,
    );

    const body = result.data.body?.trim();
    // A draft that lost the link or the fee is worse than the template, because
    // those two facts are the entire reason the message gets a reply.
    if (!body || !body.includes(input.inviteUrl)) {
      return { body: fallback, live: false };
    }
    return { body, live: result.live };
  } catch {
    return { body: fallback, live: false };
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("draft timed out")), ms),
    ),
  ]);
}
