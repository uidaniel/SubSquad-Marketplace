import { describe, expect, it } from "vitest";
import {
  isLowSignalComment,
  largestFollowerSpike,
  lowQualityCommentShare,
  scoreCreator,
  SHORTLIST_ELIGIBILITY_THRESHOLD,
  type CreatorSignals,
} from "./rules";

/** A profile that passes every rule, used as the base for single-rule tests. */
const clean: CreatorSignals = {
  handle: "chideraskits",
  bio: "Lagos skit maker. Bookings in bio.",
  followers: 128_400,
  following: 890,
  engagementRate: 0.074,
  avgLikes: 9_400,
  avgComments: 310,
  sampleComments: [
    "This is so accurate 😂 the part about danfo",
    "Omo you did not have to expose us like this",
    "Where did you shoot this? The lighting is clean",
    "My sister behaves exactly like this",
  ],
};

function reasonIds(signals: CreatorSignals) {
  return scoreCreator(signals).reasons.map((r) => r.id);
}

describe("scoreCreator", () => {
  it("gives a clean profile full marks and no reasons", () => {
    const result = scoreCreator(clean);
    expect(result.score).toBe(100);
    expect(result.reasons).toEqual([]);
    expect(result.eligibleForShortlist).toBe(true);
  });

  it("explains every deduction it makes", () => {
    const result = scoreCreator({ ...clean, engagementRate: 0.3, avgComments: 1 });
    expect(result.reasons.length).toBeGreaterThan(0);
    for (const reason of result.reasons) {
      expect(reason.label.length).toBeGreaterThan(0);
      expect(reason.evidence.length).toBeGreaterThan(0);
      expect(reason.delta).toBeLessThan(0);
    }
  });

  it("stamps when it was computed, since scores are recomputed per campaign", () => {
    const at = new Date("2026-09-16T10:00:00.000Z");
    expect(scoreCreator(clean, at).computedAt).toBe("2026-09-16T10:00:00.000Z");
  });

  describe("engagement rate", () => {
    it("penalises a dead audience", () => {
      const result = scoreCreator({ ...clean, engagementRate: 0.004 });
      expect(result.score).toBe(75);
      expect(result.reasons[0].id).toBe("engagement_out_of_band");
      expect(result.reasons[0].label).toMatch(/below/);
    });

    it("penalises an implausibly hot audience", () => {
      const result = scoreCreator({ ...clean, engagementRate: 0.22 });
      expect(result.score).toBe(75);
      expect(result.reasons[0].label).toMatch(/above/);
    });

    it("accepts the edges of the normal band", () => {
      expect(scoreCreator({ ...clean, engagementRate: 0.005 }).score).toBe(100);
      expect(scoreCreator({ ...clean, engagementRate: 0.15 }).score).toBe(100);
    });
  });

  describe("follower to following ratio", () => {
    it("penalises follow-for-follow behaviour on a large account", () => {
      const result = scoreCreator({ ...clean, followers: 50_000, following: 40_000 });
      expect(result.score).toBe(85);
      expect(result.reasons[0].id).toBe("low_follower_ratio");
    });

    it("leaves small accounts alone, where the ratio means little", () => {
      expect(reasonIds({ ...clean, followers: 8_000, following: 7_000 })).not.toContain(
        "low_follower_ratio",
      );
    });

    it("does not divide by zero when an account follows nobody", () => {
      expect(() => scoreCreator({ ...clean, following: 0 })).not.toThrow();
      expect(reasonIds({ ...clean, following: 0 })).not.toContain("low_follower_ratio");
    });
  });

  describe("comment to like ratio", () => {
    it("penalises likes without conversation", () => {
      const result = scoreCreator({ ...clean, avgLikes: 10_000, avgComments: 20 });
      expect(result.reasons.map((r) => r.id)).toContain("low_comment_ratio");
    });

    it("does not divide by zero on a profile with no likes", () => {
      expect(() => scoreCreator({ ...clean, avgLikes: 0 })).not.toThrow();
      expect(reasonIds({ ...clean, avgLikes: 0 })).not.toContain("low_comment_ratio");
    });
  });

  describe("comment quality", () => {
    it("penalises a pod-like comment sample", () => {
      const result = scoreCreator({
        ...clean,
        sampleComments: ["🔥", "🔥", "nice", "Real talk about the danfo part"],
      });
      expect(result.reasons.map((r) => r.id)).toContain("low_quality_comments");
      expect(result.score).toBe(80);
    });

    it("stays silent when no comments were sampled", () => {
      expect(reasonIds({ ...clean, sampleComments: [] })).not.toContain(
        "low_quality_comments",
      );
      expect(reasonIds({ ...clean, sampleComments: undefined })).not.toContain(
        "low_quality_comments",
      );
    });
  });

  describe("follower history", () => {
    it("penalises a sudden jump inside a 30-day window", () => {
      const result = scoreCreator({
        ...clean,
        followerHistory: [
          { at: "2026-08-01T00:00:00Z", followers: 50_000 },
          { at: "2026-08-20T00:00:00Z", followers: 90_000 },
        ],
      });
      expect(result.reasons.map((r) => r.id)).toContain("follower_spike");
    });

    it("accepts the same growth spread over a longer period", () => {
      expect(
        reasonIds({
          ...clean,
          followerHistory: [
            { at: "2026-04-01T00:00:00Z", followers: 50_000 },
            { at: "2026-08-20T00:00:00Z", followers: 90_000 },
          ],
        }),
      ).not.toContain("follower_spike");
    });

    it("stays silent when there is no history rather than assuming the best", () => {
      expect(reasonIds({ ...clean, followerHistory: undefined })).not.toContain(
        "follower_spike",
      );
      expect(
        reasonIds({
          ...clean,
          followerHistory: [{ at: "2026-08-01T00:00:00Z", followers: 50_000 }],
        }),
      ).not.toContain("follower_spike");
    });
  });

  describe("bio and handle", () => {
    it.each(["giveaway", "promo page", "repost"])("flags %s accounts", (term) => {
      const result = scoreCreator({ ...clean, bio: `Daily ${term} for my people` });
      expect(result.reasons.map((r) => r.id)).toContain("suspicious_bio");
      expect(result.score).toBe(90);
    });

    it("matches the handle as well as the bio", () => {
      expect(reasonIds({ ...clean, handle: "naija_giveaway_hq", bio: null })).toContain(
        "suspicious_bio",
      );
    });

    it("is case-insensitive", () => {
      expect(reasonIds({ ...clean, bio: "DAILY GIVEAWAY" })).toContain("suspicious_bio");
    });

    it("copes with a missing bio", () => {
      expect(() => scoreCreator({ ...clean, bio: null })).not.toThrow();
      expect(() => scoreCreator({ ...clean, bio: undefined })).not.toThrow();
    });
  });

  describe("eligibility", () => {
    it("keeps a profile sitting exactly on the threshold eligible", () => {
      // Engagement out of band (−25) plus a poor follower ratio (−15) lands on 60.
      const result = scoreCreator({
        ...clean,
        engagementRate: 0.3,
        followers: 50_000,
        following: 45_000,
      });
      expect(result.score).toBe(SHORTLIST_ELIGIBILITY_THRESHOLD);
      expect(result.eligibleForShortlist).toBe(true);
    });

    it("excludes a profile one rule below the threshold", () => {
      // The same profile, plus a pod-like comment sample (−20), drops to 40.
      const result = scoreCreator({
        ...clean,
        engagementRate: 0.3,
        followers: 50_000,
        following: 45_000,
        sampleComments: ["🔥", "🔥", "🔥", "nice"],
      });
      expect(result.score).toBe(40);
      expect(result.eligibleForShortlist).toBe(false);
    });

    it("never scores below zero however many rules fire", () => {
      const result = scoreCreator({
        handle: "giveaway_promo_page",
        bio: "repost giveaway promo page",
        followers: 500_000,
        following: 480_000,
        engagementRate: 0.9,
        avgLikes: 100_000,
        avgComments: 1,
        sampleComments: ["🔥", "🔥", "🔥", "🔥"],
        followerHistory: [
          { at: "2026-08-01T00:00:00Z", followers: 100_000 },
          { at: "2026-08-15T00:00:00Z", followers: 500_000 },
        ],
      });
      expect(result.score).toBe(0);
      expect(result.eligibleForShortlist).toBe(false);
      expect(result.reasons).toHaveLength(6);
    });
  });
});

describe("isLowSignalComment", () => {
  it.each(["🔥", "🔥🔥🔥", "❤️", "👏🏾👏🏾", "  ", "nice", "Wow!", "LOVE IT"])(
    "treats %j as carrying no signal",
    (comment) => {
      expect(isLowSignalComment(comment)).toBe(true);
    },
  );

  it.each([
    "🔥 the danfo part killed me",
    "Where is this place?",
    "nice work on the lighting here",
  ])("treats %j as a real comment", (comment) => {
    expect(isLowSignalComment(comment)).toBe(false);
  });
});

describe("lowQualityCommentShare", () => {
  it("counts duplicates as low quality even when the text reads normally", () => {
    const share = lowQualityCommentShare([
      "Check my page for collabs",
      "Check my page for collabs",
      "Genuinely useful, thank you",
      "Another real comment here",
    ]);
    // The second copy is flagged; the first is left as a genuine comment.
    expect(share).toBeCloseTo(0.25);
  });

  it("returns zero for an empty sample rather than dividing by zero", () => {
    expect(lowQualityCommentShare([])).toBe(0);
  });
});

describe("largestFollowerSpike", () => {
  it("finds the sharpest jump inside the window", () => {
    expect(
      largestFollowerSpike([
        { at: "2026-08-01T00:00:00Z", followers: 10_000 },
        { at: "2026-08-10T00:00:00Z", followers: 11_000 },
        { at: "2026-08-25T00:00:00Z", followers: 20_000 },
      ]),
    ).toBeCloseTo(1.0);
  });

  it("ignores growth that falls outside any 30-day window", () => {
    expect(
      largestFollowerSpike([
        { at: "2026-01-01T00:00:00Z", followers: 10_000 },
        { at: "2026-08-01T00:00:00Z", followers: 30_000 },
      ]),
    ).toBe(0);
  });

  it("returns zero rather than throwing on unusable history", () => {
    expect(largestFollowerSpike(undefined)).toBe(0);
    expect(largestFollowerSpike([])).toBe(0);
    expect(largestFollowerSpike([{ at: "nonsense", followers: 10 }])).toBe(0);
  });
});
