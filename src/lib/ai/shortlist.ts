import "server-only";

import { requireServiceClient } from "@/lib/supabase/service";
import { one } from "@/lib/data/relations";
import { callModel } from "./client";
import { shortlistSchema } from "./schemas";
import {
  SHORTLIST_VERSION,
  shortlistSystemPrompt,
  shortlistUserPrompt,
  type ShortlistCandidateInput,
} from "./prompts/shortlist";
import { SHORTLIST_ELIGIBILITY_THRESHOLD } from "@/lib/fraud/rules";
import type { Brief } from "@/lib/domain";
import type { Kobo } from "@/lib/money";

/**
 * Generating a shortlist.
 *
 * Three steps, and the model only does the middle one:
 *
 *   1. Postgres narrows thousands of creators to a pool of sixty — by platform,
 *      by fraud score, and excluding anyone already on this campaign. Cheap,
 *      deterministic, and it means the model never sees a creator it should not.
 *   2. The model ranks that pool against the brief and explains each choice.
 *   3. The results are written as `proposed`, which is a suggestion and nothing
 *      more. No creator is contacted and no money moves until a person approves.
 *
 * Nothing here contacts anybody. That separation is the whole safety model.
 */

const POOL_SIZE = 60;
const DEFAULT_WANTED = 20;

export interface ShortlistResult {
  created: number;
  /** False when no API key is set and the stub ran instead. */
  live: boolean;
  /** Candidates the model named that were not in the pool we gave it. */
  hallucinated: number;
}

export class ShortlistError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShortlistError";
  }
}

export async function generateShortlist(
  campaignId: string,
  options: { wanted?: number } = {},
): Promise<ShortlistResult> {
  const db = requireServiceClient();
  const wanted = options.wanted ?? DEFAULT_WANTED;

  const { data: campaign } = await db
    .from("campaigns")
    .select(
      "id, name, end_brand_name, brief, rate_band_min_kobo, rate_band_max_kobo, campaign_slots(id, deliverable_type, count, fee_kobo)",
    )
    .eq("id", campaignId)
    .maybeSingle();

  if (!campaign) throw new ShortlistError("That campaign no longer exists.");

  const slots = (campaign.campaign_slots ?? []) as {
    id: string;
    deliverable_type: string;
    count: number;
    fee_kobo: number;
  }[];

  if (slots.length === 0) {
    throw new ShortlistError(
      "This campaign has no deliverables yet, so there is nothing to match creators against.",
    );
  }

  // The platforms the brief actually needs. "tiktok_video" and "ig_reel" become
  // "tiktok" and "ig", which is how the creator rows record a primary platform.
  const platforms = [
    ...new Set(slots.map((s) => s.deliverable_type.split("_")[0])),
  ].map((p) => (p === "ig" ? "instagram" : p === "yt" ? "youtube" : p));

  // Anyone already invited to this campaign is out — a second invite to the same
  // person for the same job is the fastest way to look like a spam operation.
  const { data: existing } = await db
    .from("deals")
    .select("creator_id")
    .eq("campaign_id", campaignId);
  const already = new Set((existing ?? []).map((d) => d.creator_id as string));

  const pool = await buildPool(platforms, already);

  if (pool.length === 0) {
    throw new ShortlistError(
      "No creators in the index match this brief's platforms and pass the fraud threshold. Import more creators first.",
    );
  }

  const brief = campaign.brief as Brief;

  const result = await callModel(
    {
      purpose: "shortlist",
      campaignId,
      promptVersion: SHORTLIST_VERSION,
    },
    {
      system: shortlistSystemPrompt(),
      user: shortlistUserPrompt({
        brief,
        campaignName: campaign.name as string,
        brandName: campaign.end_brand_name as string,
        slots: slots.map((s) => ({
          deliverable: s.deliverable_type,
          count: s.count,
          feeKobo: Number(s.fee_kobo),
        })),
        rateBandMinKobo: Number(campaign.rate_band_min_kobo),
        rateBandMaxKobo: Number(campaign.rate_band_max_kobo),
        wanted,
        candidates: pool,
      }),
      schema: shortlistSchema,
      // Without a key, rank by fraud score and say so plainly. A reviewer
      // seeing "ranked without AI" knows exactly how much to trust the order.
      stub: {
        candidates: pool.slice(0, wanted).map((c) => ({
          creatorId: c.creatorId,
          fitScore: c.fraudScore ?? 50,
          reasoning:
            "Ranked without AI — no model is configured, so this is ordered by fraud score alone and has not been matched against the brief.",
          estimatedFeeKobo: Number(campaign.rate_band_max_kobo) || 5_000_000,
          flags: ["not_ai_ranked"],
        })),
      },
    },
  );

  const poolIds = new Set(pool.map((c) => c.creatorId));
  const valid = result.data.candidates.filter((c) => poolIds.has(c.creatorId));
  const hallucinated = result.data.candidates.length - valid.length;

  if (valid.length === 0) {
    throw new ShortlistError(
      "The model did not return any creators from the pool. Try again — if it keeps happening, the brief may be too narrow.",
    );
  }

  // Replacing rather than appending: regenerating means "this shortlist was
  // wrong, do it again", and leaving the old proposals behind would quietly
  // double the list. Approved and removed rows are somebody's decision, so
  // those stay.
  await db
    .from("shortlist_items")
    .delete()
    .eq("campaign_id", campaignId)
    .eq("status", "proposed");

  const slotFor = (index: number) => slots[index % slots.length].id;

  const { error } = await db.from("shortlist_items").insert(
    valid.map((c, index) => ({
      campaign_id: campaignId,
      creator_id: c.creatorId,
      slot_id: slotFor(index),
      ai_reasoning: c.reasoning,
      fit_score: c.fitScore,
      estimated_fee_kobo: clampToBand(
        c.estimatedFeeKobo,
        Number(campaign.rate_band_min_kobo),
        Number(campaign.rate_band_max_kobo),
      ),
      status: "proposed",
    })),
  );

  if (error) throw new ShortlistError(error.message);

  await db
    .from("campaigns")
    .update({ status: "shortlisting" })
    .eq("id", campaignId);

  return { created: valid.length, live: result.live, hallucinated };
}

/**
 * Keeps an estimated fee inside the agency's band.
 *
 * The prompt asks for this and the model usually obeys, but "usually" is not a
 * guarantee worth betting an agency's margin on — and a fee above the ceiling
 * would be offered to a creator before anybody noticed.
 */
function clampToBand(fee: Kobo, min: Kobo, max: Kobo): Kobo {
  if (max <= 0) return fee;
  return Math.min(Math.max(fee, min > 0 ? min : 1), max);
}

/**
 * The candidate pool.
 *
 * Ordered by fraud score so that when there are more eligible creators than the
 * pool holds, the ones the model never sees are the least trustworthy rather
 * than an arbitrary sixty.
 *
 * The spec calls for pgvector similarity against the brief embedding. That needs
 * profile embeddings, which need the tagging job; until then this is the same
 * filter without the semantic ordering, and the model still reads every profile
 * it is given.
 */
async function buildPool(
  platforms: string[],
  exclude: Set<string>,
): Promise<ShortlistCandidateInput[]> {
  const db = requireServiceClient();

  const { data } = await db
    .from("creators")
    .select(
      "id, handle, display_name, primary_platform, status, creator_profiles(followers, engagement_rate, avg_views, category_tags, languages, location_city, sample_posts), creator_scores(fraud_score, reasons, computed_at)",
    )
    .in("primary_platform", platforms)
    .neq("status", "suspended")
    .eq("do_not_contact", false)
    .limit(200);

  const rows = (data ?? [])
    .filter((row) => !exclude.has(row.id as string))
    .map((row) => {
      const profile = one(row.creator_profiles);
      const score = one(row.creator_scores);
      const fraudScore =
        score?.fraud_score === undefined || score?.fraud_score === null
          ? null
          : Number(score.fraud_score);

      const reasons = Array.isArray(score?.reasons)
        ? (score!.reasons as { label?: string }[])
            .map((r) => r.label)
            .filter((l): l is string => Boolean(l))
        : [];

      const samples = Array.isArray(profile?.sample_posts)
        ? (profile!.sample_posts as {
            caption?: string;
            views?: number;
            transcript?: string;
          }[])
        : [];

      return {
        creatorId: row.id as string,
        handle: row.handle as string,
        displayName: row.display_name as string,
        platform: row.primary_platform as string,
        followers: Number(profile?.followers ?? 0),
        engagementRate: Number(profile?.engagement_rate ?? 0),
        avgViews: profile?.avg_views ? Number(profile.avg_views) : null,
        city: (profile?.location_city as string) ?? null,
        languages: (profile?.languages as string[]) ?? [],
        categoryTags: (profile?.category_tags as string[]) ?? [],
        fraudScore,
        fraudReasons: reasons,
        samplePosts: samples
          .filter((p) => p.caption)
          .map((p) => ({
            caption: p.caption!,
            views: p.views ?? null,
            transcript: p.transcript ?? null,
          })),
      } satisfies ShortlistCandidateInput;
    })
    // An unscored creator has not been checked, which is not the same as having
    // passed. They are held back rather than quietly treated as clean.
    .filter(
      (c) =>
        c.fraudScore !== null && c.fraudScore >= SHORTLIST_ELIGIBILITY_THRESHOLD,
    )
    .sort((a, b) => (b.fraudScore ?? 0) - (a.fraudScore ?? 0));

  return rows.slice(0, POOL_SIZE);
}
