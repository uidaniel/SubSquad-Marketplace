import { z } from "zod";

/**
 * What the model is allowed to return.
 *
 * Every AI call in this product is parsed against one of these before anything
 * downstream sees it. A model that returns prose where a number belongs, or
 * invents a status value, fails here rather than three layers later — and the
 * failure is logged with the raw output so the prompt can be fixed.
 */

export const briefSchema = z.object({
  objective: z.enum(["awareness", "consideration", "conversion"]),
  product: z.string().min(1),
  keyMessages: z.array(z.string()).min(1).max(5),
  mustInclude: z.array(z.string()).max(10),
  mustAvoid: z.array(z.string()).max(10),
  audience: z.object({
    ageRange: z.tuple([z.number().int().min(13), z.number().int().max(99)]),
    gender: z.enum(["any", "female", "male"]),
    cities: z.array(z.string()),
    languages: z.array(z.string()),
  }),
  platforms: z.array(z.string()).min(1),
  tone: z.string(),
  disclosureTag: z.string().default("#ad"),
  arconCategory: z.enum(["general", "financial", "alcohol", "betting", "health"]),
  usageRightsDays: z.number().int().min(0).max(3650).default(90),
});

export type BriefOutput = z.infer<typeof briefSchema>;

/* ==========================================================================
   Shortlist
   ========================================================================== */

export const shortlistCandidateSchema = z.object({
  creatorId: z.string().min(1),
  fitScore: z.number().int().min(0).max(100),
  /**
   * Two or three sentences a person can disagree with. The prompt asks for the
   * specific reason this creator fits this brief, not a restatement of their
   * follower count, because a reason that would fit any creator is not a reason.
   */
  reasoning: z.string().min(40).max(600),
  estimatedFeeKobo: z.number().int().positive(),
  flags: z.array(z.string()).max(5).default([]),
});

export const shortlistSchema = z.object({
  candidates: z.array(shortlistCandidateSchema).max(30),
});

export type ShortlistOutput = z.infer<typeof shortlistSchema>;

/* ==========================================================================
   Content review
   ========================================================================== */

export const contentCheckSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  status: z.enum(["pass", "fail", "unclear"]),
  /** Where in the video or caption this was found. Required for a fail. */
  evidence: z.string().optional(),
});

export const contentReviewSchema = z
  .object({
    passes: z.boolean(),
    checks: z.array(contentCheckSchema).min(1),
    riskFlags: z.array(z.string()).default([]),
    /**
     * Written to the creator, not about them. The prompt asks for a numbered
     * list of fixes in plain, warm Nigerian English — this is the text that
     * actually reaches a person's WhatsApp.
     */
    creatorFeedback: z.string().min(1),
  })
  .refine(
    (review) => review.passes === !review.checks.some((c) => c.status === "fail"),
    {
      message:
        "passes must agree with the checks: a review cannot pass while a check has failed",
      path: ["passes"],
    },
  );

export type ContentReviewOutput = z.infer<typeof contentReviewSchema>;

/* ==========================================================================
   Outreach
   ========================================================================== */

export const messageDraftSchema = z.object({
  /** Max 90 words is enforced in the prompt and checked here. */
  body: z.string().min(1),
  /** Why this is what to say — shown to the person approving it. */
  rationale: z.string().max(400).optional(),
  /** Set when the creator asked for more than the campaign can pay. */
  suggestedFeeKobo: z.number().int().positive().nullable().default(null),
});

export type MessageDraftOutput = z.infer<typeof messageDraftSchema>;

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/* ==========================================================================
   Profile tagging
   ========================================================================== */

export const profileTagsSchema = z.object({
  categoryTags: z.array(z.string()).min(1).max(8),
  languages: z.array(z.string()).min(1).max(6),
  brandSafetyFlags: z.array(z.string()).max(6).default([]),
  /** Around sixty words; becomes the text the shortlist embedding is built from. */
  summary: z.string().min(20).max(800),
});

export type ProfileTagsOutput = z.infer<typeof profileTagsSchema>;
