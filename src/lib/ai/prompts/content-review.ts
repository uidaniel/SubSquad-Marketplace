import type { Brief } from "@/lib/domain";

/**
 * Content review.
 *
 * This prompt decides whether a creator gets paid on time or gets sent back for
 * a revision, so two things matter more than accuracy in the abstract:
 *
 *  - It must not fail a draft on taste. The brief is a contract; anything not in
 *    it is not grounds for a revision, and the prompt says so explicitly.
 *  - The feedback it writes goes to the creator unedited when a draft fails.
 *    So it is written to a person, in their language, with the fixes numbered —
 *    not as a QA report about them.
 */

export const CONTENT_REVIEW_VERSION = "content_review.v1";

export function contentReviewSystemPrompt(): string {
  return `You review draft social content for SubSquad, an escrow platform for creator campaigns in Nigeria.

Your job is to check a draft against the brief it was commissioned under, and nothing else.

How to judge:
- Check only what the brief actually asks for. Style, pacing, humour and production quality are the creator's business, not yours. A draft you personally find weak but which meets every requirement passes.
- Mark a check "fail" only when the requirement is clearly unmet and you can point to where. Mark it "unclear" when you genuinely cannot tell from the transcript and frames — do not guess, and do not fail a creator for a limitation of your own inputs.
- Disclosure is not negotiable. Nigerian advertising rules (ARCON) require the disclosure tag in the caption. A missing tag is always a fail.
- Financial, health, alcohol and betting content carries extra risk. Flag specific claims — "guaranteed returns", "cures", gambling shown near anyone who looks under 18 — in riskFlags. Flagging escalates to a human; it does not by itself fail the draft.

How to write creatorFeedback:
- You are writing to the creator, and this text is sent to them as-is on WhatsApp.
- Warm, direct, plain Nigerian English. No corporate tone, no "unfortunately", no lecturing.
- If the draft passes, say so in one line and thank them.
- If it fails, give a numbered list of only the things that must change, each one specific enough to act on without asking a follow-up question. Say what is already right first — a creator who has done nine things well should hear that before the one thing they missed.
- Never mention scores, internal checks, or that an AI reviewed it.

Return only JSON matching the required schema.`;
}

export function contentReviewUserPrompt(input: {
  brief: Brief;
  caption: string;
  transcript: string | null;
  frameDescriptions: string[];
  /** Second and later submissions get a note; a creator should not be sent back twice for the same thing. */
  attemptNumber: number;
  previousFeedback?: string | null;
}): string {
  const { brief } = input;

  const checks = [
    ...brief.keyMessages.map((message, i) => ({
      id: `key_message_${i + 1}`,
      label: `Mentions: ${message}`,
    })),
    ...brief.mustInclude.map((item, i) => ({
      id: `must_include_${i + 1}`,
      label: `Includes: ${item}`,
    })),
    ...brief.mustAvoid.map((item, i) => ({
      id: `must_avoid_${i + 1}`,
      label: `Avoids: ${item}`,
    })),
    { id: "disclosure", label: `Disclosure tag ${brief.disclosureTag} in the caption` },
  ];

  return `# The brief

Product: ${brief.product}
Objective: ${brief.objective}
Tone asked for: ${brief.tone}
Category: ${brief.arconCategory}
Audience: ${brief.audience.ageRange[0]}–${brief.audience.ageRange[1]}, ${brief.audience.cities.join(", ")}, speaking ${brief.audience.languages.join(" / ")}

# The checks to run, by id

${checks.map((c) => `- ${c.id}: ${c.label}`).join("\n")}

# The draft

Caption as submitted:
"""
${input.caption}
"""

${
  input.transcript
    ? `Spoken transcript:\n"""\n${input.transcript}\n"""`
    : "No transcript is available for this draft. Judge only from the caption and frames, and mark anything you cannot verify as unclear rather than failed."
}

${
  input.frameDescriptions.length
    ? `What is visible in the video, frame by frame:\n${input.frameDescriptions
        .map((d, i) => `${i + 1}. ${d}`)
        .join("\n")}`
    : "No frame descriptions are available."
}

# Context

This is submission ${input.attemptNumber}.${
    input.attemptNumber > 1 && input.previousFeedback
      ? ` Last time they were told:\n"""\n${input.previousFeedback}\n"""\nCheck specifically whether those points are now addressed, and do not raise new requirements that were not mentioned then unless the brief demands it.`
      : ""
  }

Return the review as JSON with: passes (boolean), checks (array of {id, label, status, evidence}), riskFlags (array of strings), creatorFeedback (string).`;
}
