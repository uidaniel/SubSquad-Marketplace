/**
 * Model configuration, in one place.
 *
 * Nothing else in the codebase names a model. When a better model ships, or a
 * cheaper one turns out to be good enough for tagging, it is changed here and
 * the change is visible in one diff rather than scattered across five callers.
 */

export const MODELS = {
  /** Ranking and writing to a creator: the calls a person will read closely. */
  reasoning: "claude-sonnet-5",
  /** High-volume, low-stakes: profile tagging over thousands of rows. */
  fast: "claude-haiku-4-5-20251001",
  /** Reading a video's frames. */
  vision: "claude-sonnet-5",
} as const;

export type ModelRole = keyof typeof MODELS;

/** Per-purpose settings, so a change to one call cannot silently affect another. */
export const AI_CONFIG = {
  shortlist: { model: MODELS.reasoning, maxTokens: 4096, temperature: 0.2 },
  invite_draft: { model: MODELS.reasoning, maxTokens: 1024, temperature: 0.6 },
  reply_draft: { model: MODELS.reasoning, maxTokens: 1024, temperature: 0.5 },
  content_review: { model: MODELS.vision, maxTokens: 2048, temperature: 0 },
  profile_tagging: { model: MODELS.fast, maxTokens: 1024, temperature: 0.1 },
} as const;

export type AiPurpose = keyof typeof AI_CONFIG;
