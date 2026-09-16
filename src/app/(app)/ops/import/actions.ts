"use server";

import { revalidatePath } from "next/cache";
import { requireServiceClient } from "@/lib/supabase/service";
import { requireStaff } from "@/lib/auth/staff";
import { env } from "@/lib/env";
import type { ParsedCreator } from "@/lib/creators/import";

/**
 * Writing an import to the index.
 *
 * Upserted on (platform, handle) so re-importing an updated spreadsheet
 * refreshes the numbers rather than creating a second copy of everybody — which
 * is exactly what happens in practice, because the file is maintained by hand
 * and imported again every few weeks.
 *
 * What is never overwritten is anything the creator gave us themselves: a
 * verified phone number, payout details, onboarding state. A stale spreadsheet
 * must not be able to redirect somebody's money.
 */

export type ImportResult =
  | { inserted: number; updated: number }
  | { error: string };

export async function importCreators(
  creators: ParsedCreator[],
): Promise<ImportResult> {
  if (env.demoMode) {
    return { error: "Connect a Supabase project to import creators." };
  }
  await requireStaff();

  if (creators.length === 0) return { error: "Nothing to import." };
  if (creators.length > 2000) {
    return { error: "That is a lot at once. Split the file into batches of 2,000." };
  }

  const db = requireServiceClient();

  const keys = creators.map((c) => `${c.platform}:${c.handle.toLowerCase()}`);
  const { data: existing } = await db
    .from("creators")
    .select("id, handle, primary_platform")
    .in(
      "handle",
      creators.map((c) => c.handle),
    );

  const existingKeys = new Set(
    (existing ?? []).map(
      (e) => `${e.primary_platform}:${String(e.handle).toLowerCase()}`,
    ),
  );
  const updated = keys.filter((k) => existingKeys.has(k)).length;

  const { data: rows, error } = await db
    .from("creators")
    .upsert(
      creators.map((c) => ({
        handle: c.handle,
        primary_platform: c.platform,
        display_name: c.displayName,
        phone: c.phone,
        email: c.email,
        contact_source: c.contactSource,
        status: "indexed",
      })),
      { onConflict: "primary_platform,handle", ignoreDuplicates: false },
    )
    .select("id, handle, primary_platform");

  if (error) return { error: error.message };

  const idFor = new Map(
    (rows ?? []).map((r) => [
      `${r.primary_platform}:${String(r.handle).toLowerCase()}`,
      r.id as string,
    ]),
  );

  // Profiles and scores are separate rows because both are recomputed on their
  // own schedule — a profile is refetched, a score is recomputed per campaign.
  const profiles = creators
    .map((c) => {
      const id = idFor.get(`${c.platform}:${c.handle.toLowerCase()}`);
      if (!id) return null;
      return {
        creator_id: id,
        platform: c.platform,
        followers: c.followers,
        following: c.following,
        avg_likes: c.avgLikes,
        avg_comments: c.avgComments,
        engagement_rate: c.engagementRate,
        category_tags: c.categoryTags,
        location_city: c.city,
        fetched_at: new Date().toISOString(),
      };
    })
    .filter(Boolean);

  if (profiles.length) {
    await db
      .from("creator_profiles")
      .upsert(profiles as Record<string, unknown>[], {
        onConflict: "creator_id,platform",
      });
  }

  const scores = creators
    .map((c) => {
      const id = idFor.get(`${c.platform}:${c.handle.toLowerCase()}`);
      if (!id) return null;
      return {
        creator_id: id,
        campaign_id: null,
        fraud_score: c.fraudScore,
        reasons: c.fraudReasons,
        computed_at: new Date().toISOString(),
      };
    })
    .filter(Boolean);

  if (scores.length) {
    await db.from("creator_scores").insert(scores as Record<string, unknown>[]);
  }

  revalidatePath("/creators");
  revalidatePath("/ops/import");

  return { inserted: creators.length - updated, updated };
}
