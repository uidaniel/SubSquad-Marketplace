/**
 * Model configuration, in one place.
 *
 * Nothing else in the codebase names a model. When a better model ships, or a
 * cheaper one turns out to be good enough for tagging, it is changed here and
 * the change is visible in one diff rather than scattered across five callers.
 */

/**
 * Which model does what, and why.
 *
 * The whole AI bill for one 15-creator campaign is a few hundred naira, so the
 * choices below are about quality per call rather than saving money. Where they
 * differ, the rule is: the more expensive model is used where being wrong is
 * expensive, and the cheap one everywhere else.
 */
export const MODELS = {
  /**
   * Ranking creators and drafting messages a person will read closely.
   * Haiku is good enough here and half the price — a shortlist is reviewed by a
   * human before anything happens, so a mediocre ranking costs a click.
   */
  reasoning: "claude-haiku-4-5",

  /** High-volume, low-stakes: tagging thousands of profiles on import. */
  fast: "claude-haiku-4-5",

  /**
   * Reading a draft against the brief.
   *
   * The one place that pays for a better model. This call decides whether an
   * ad carries its ARCON disclosure, and a miss is a regulatory problem rather
   * than an inconvenience — so it does not run on the cheap model.
   */
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
