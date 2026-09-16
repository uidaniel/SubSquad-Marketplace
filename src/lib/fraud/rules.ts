/**
 * Fraud and quality scoring, v1.
 *
 * Bought engagement is normal in this market, so every creator is scored before
 * a brand ever sees them. This is deliberately rules-based rather than a model:
 * a creator can appeal, and an appeal is only answerable if we can say exactly
 * which rule fired and on what evidence. Each rule therefore returns the number
 * it deducted and a sentence a person can argue with.
 *
 * Score runs 0–100 where higher is more trustworthy. 60 is the floor for
 * shortlist eligibility.
 */

export const SHORTLIST_ELIGIBILITY_THRESHOLD = 60;

export interface CreatorSignals {
  handle: string;
  bio?: string | null;
  followers: number;
  following: number;
  /** Engagement rate as a fraction: 0.074 is 7.4%. */
  engagementRate: number;
  avgLikes: number;
  avgComments: number;
  /** Raw text of sampled comments, used to spot pods and bot replies. */
  sampleComments?: string[];
  /** Follower counts observed earlier, newest last. Optional — most imports lack history. */
  followerHistory?: { at: string; followers: number }[];
}

export interface ScoreReason {
  /** Stable id so the same finding can be tracked across recomputes. */
  id: string;
  /** What a person sees. Written to be understood by the creator, not just ops. */
  label: string;
  /** Points deducted. Always negative. */
  delta: number;
  /** The measurement that triggered it, so the creator can check it. */
  evidence: string;
}

export interface CreatorScore {
  score: number;
  reasons: ScoreReason[];
  eligibleForShortlist: boolean;
  computedAt: string;
}

const PENALTIES = {
  engagementOutOfBand: -25,
  lowFollowerRatio: -15,
  lowCommentRatio: -15,
  lowQualityComments: -20,
  followerSpike: -20,
  suspiciousBio: -10,
} as const;

const ENGAGEMENT_FLOOR = 0.005; // 0.5% — below this the audience is not listening
const ENGAGEMENT_CEILING = 0.15; // 15% — above this it is usually bought
const FOLLOWER_RATIO_FLOOR = 1.5;
const FOLLOWER_RATIO_APPLIES_ABOVE = 10_000;
const COMMENT_LIKE_RATIO_FLOOR = 0.005; // 0.5%
const LOW_QUALITY_COMMENT_SHARE = 0.3; // 30% of the sample
const FOLLOWER_SPIKE_SHARE = 0.4; // 40% in 30 days
const SPIKE_WINDOW_DAYS = 30;

const SUSPICIOUS_BIO_TERMS = ["giveaway", "promo page", "repost"];

const percent = (n: number) => `${(n * 100).toFixed(1)}%`;

/** True when a comment carries no signal: a lone emoji, or "🔥🔥🔥", or "nice". */
export function isLowSignalComment(comment: string): boolean {
  const text = comment.trim();
  if (text.length === 0) return true;

  // Emoji-only, of any length. Anything that is not an emoji, modifier or space
  // disqualifies it — so "🔥 love this" counts as a real comment.
  const withoutEmoji = text
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Component}️‍]/gu, "")
    .trim();
  if (withoutEmoji.length === 0) return true;

  // One word of generic praise.
  if (/^(nice|great|wow|cool|fire|dope|sweet|amazing|love it|good)!*$/i.test(text)) {
    return true;
  }
  return false;
}

/**
 * Share of the comment sample that is low-signal or repeated.
 *
 * Duplicates matter as much as emoji: identical strings across posts is the
 * clearest signature of an engagement pod.
 */
export function lowQualityCommentShare(comments: string[]): number {
  if (comments.length === 0) return 0;
  const seen = new Map<string, number>();
  let flagged = 0;
  for (const raw of comments) {
    const key = raw.trim().toLowerCase();
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    if (isLowSignalComment(raw) || count > 1) flagged += 1;
  }
  return flagged / comments.length;
}

/**
 * Largest proportional jump inside any 30-day window of the history.
 *
 * Organic growth is gradual; a step change is bought followers or a transfer of
 * an existing account. Returns 0 when there is too little history to judge,
 * which must never be read as "clean" — it is "unknown", and the rule stays silent.
 */
export function largestFollowerSpike(
  history: { at: string; followers: number }[] | undefined,
): number {
  if (!history || history.length < 2) return 0;
  const points = [...history]
    .map((p) => ({ at: new Date(p.at).getTime(), followers: p.followers }))
    .filter((p) => Number.isFinite(p.at) && p.followers > 0)
    .sort((a, b) => a.at - b.at);
  if (points.length < 2) return 0;

  const windowMs = SPIKE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  let largest = 0;
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      if (points[j].at - points[i].at > windowMs) break;
      const growth = (points[j].followers - points[i].followers) / points[i].followers;
      if (growth > largest) largest = growth;
    }
  }
  return largest;
}

/**
 * Scores a creator, returning the reasons alongside the number.
 *
 * Deductions are independent and additive; the result is clamped to 0–100 so a
 * profile that fails everything still lands on a comparable scale.
 */
export function scoreCreator(signals: CreatorSignals, now = new Date()): CreatorScore {
  const reasons: ScoreReason[] = [];

  if (
    signals.engagementRate < ENGAGEMENT_FLOOR ||
    signals.engagementRate > ENGAGEMENT_CEILING
  ) {
    const tooLow = signals.engagementRate < ENGAGEMENT_FLOOR;
    reasons.push({
      id: "engagement_out_of_band",
      label: tooLow
        ? "Engagement is far below the normal range"
        : "Engagement is far above the normal range",
      delta: PENALTIES.engagementOutOfBand,
      evidence: `${percent(signals.engagementRate)} engagement; expected between ${percent(
        ENGAGEMENT_FLOOR,
      )} and ${percent(ENGAGEMENT_CEILING)}`,
    });
  }

  if (signals.followers > FOLLOWER_RATIO_APPLIES_ABOVE && signals.following > 0) {
    const ratio = signals.followers / signals.following;
    if (ratio < FOLLOWER_RATIO_FLOOR) {
      reasons.push({
        id: "low_follower_ratio",
        label: "Follows almost as many accounts as follow back",
        delta: PENALTIES.lowFollowerRatio,
        evidence: `${signals.followers.toLocaleString()} followers against ${signals.following.toLocaleString()} following (${ratio.toFixed(
          2,
        )}×)`,
      });
    }
  }

  if (signals.avgLikes > 0) {
    const commentRatio = signals.avgComments / signals.avgLikes;
    if (commentRatio < COMMENT_LIKE_RATIO_FLOOR) {
      reasons.push({
        id: "low_comment_ratio",
        label: "Very few comments for the number of likes",
        delta: PENALTIES.lowCommentRatio,
        evidence: `${percent(commentRatio)} comment-to-like ratio; likes without conversation are commonly purchased`,
      });
    }
  }

  const comments = signals.sampleComments ?? [];
  if (comments.length > 0) {
    const share = lowQualityCommentShare(comments);
    if (share >= LOW_QUALITY_COMMENT_SHARE) {
      reasons.push({
        id: "low_quality_comments",
        label: "Comments are mostly emoji or repeated text",
        delta: PENALTIES.lowQualityComments,
        evidence: `${percent(share)} of ${comments.length} sampled comments were a single emoji or a duplicate`,
      });
    }
  }

  const spike = largestFollowerSpike(signals.followerHistory);
  if (spike > FOLLOWER_SPIKE_SHARE) {
    reasons.push({
      id: "follower_spike",
      label: "Follower count jumped suddenly",
      delta: PENALTIES.followerSpike,
      evidence: `grew ${percent(spike)} inside ${SPIKE_WINDOW_DAYS} days`,
    });
  }

  const haystack = `${signals.handle} ${signals.bio ?? ""}`.toLowerCase();
  const hit = SUSPICIOUS_BIO_TERMS.find((term) => haystack.includes(term));
  if (hit) {
    reasons.push({
      id: "suspicious_bio",
      label: "Profile describes itself as a promo or repost account",
      delta: PENALTIES.suspiciousBio,
      evidence: `"${hit}" appears in the handle or bio`,
    });
  }

  const score = Math.max(
    0,
    Math.min(100, 100 + reasons.reduce((sum, r) => sum + r.delta, 0)),
  );

  return {
    score,
    reasons,
    eligibleForShortlist: score >= SHORTLIST_ELIGIBILITY_THRESHOLD,
    computedAt: now.toISOString(),
  };
}
