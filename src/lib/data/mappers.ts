import type {
  Creator,
  CreatorProfile,
  CreatorScoreRecord,
} from "@/lib/domain";

/**
 * Rows into domain objects.
 *
 * These lived inside supabase-queries.ts, unexported, so the creator surface
 * could not reach them — and the creator's own profile page fell back to the
 * demo fixtures, showing a real creator somebody else's follower count. One
 * definition, imported by both sides, so a column rename touches one file and
 * the two surfaces cannot drift.
 */

export function toCreator(row: Record<string, unknown>): Creator {
  return {
    id: row.id as string,
    displayName: row.display_name as string,
    primaryPlatform: row.primary_platform as string,
    handle: row.handle as string,
    phone: (row.phone as string) ?? null,
    email: (row.email as string) ?? null,
    whatsappOptIn: Boolean(row.whatsapp_opt_in),
    status: row.status as Creator["status"],
    payoutBankCode: (row.payout_bank_code as string) ?? null,
    payoutAccountNumber: (row.payout_account_number as string) ?? null,
    payoutAccountName: (row.payout_account_name as string) ?? null,
    payoutVerified: Boolean(row.payout_verified),
    userId: (row.user_id as string) ?? null,
    contactSource: row.contact_source as Creator["contactSource"],
    doNotContact: Boolean(row.do_not_contact),
    lastContactedAt: (row.last_contacted_at as string) ?? null,
  };
}

export function toProfile(row: Record<string, unknown>): CreatorProfile {
  return {
    id: row.id as string,
    creatorId: row.creator_id as string,
    platform: row.platform as string,
    followers: Number(row.followers),
    following: Number(row.following),
    postsCount: Number(row.posts_count),
    avgViews: Number(row.avg_views),
    avgLikes: Number(row.avg_likes),
    avgComments: Number(row.avg_comments),
    engagementRate: Number(row.engagement_rate),
    categoryTags: (row.category_tags as string[]) ?? [],
    languages: (row.languages as string[]) ?? [],
    locationCity: (row.location_city as string) ?? null,
    samplePosts: (row.sample_posts as CreatorProfile["samplePosts"]) ?? [],
    fetchedAt: row.fetched_at as string,
  };
}

export function toScore(row: Record<string, unknown>): CreatorScoreRecord {
  return {
    id: row.id as string,
    creatorId: row.creator_id as string,
    campaignId: (row.campaign_id as string) ?? null,
    fraudScore: Number(row.fraud_score),
    reasons: (row.reasons as CreatorScoreRecord["reasons"]) ?? [],
    computedAt: row.computed_at as string,
  };
}
