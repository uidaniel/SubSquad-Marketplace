import "server-only";

import { env } from "@/lib/env";
import * as live from "./creator-live";

import {
  creatorAccountFor,
  DEMO_CAMPAIGNS,
  DEMO_CREATORS,
  DEMO_DEALS,
  DEMO_DRAFTS,
  DEMO_SPACES,
  demoBalances,
  escrowAccountFor,
} from "@/lib/demo/data";
import type { Campaign, Creator, Deal, Draft } from "@/lib/domain";
import type { Kobo } from "@/lib/money";

/**
 * Read models for the creator and guest-brand surfaces.
 *
 * These are separate from the org queries because they are reached without an
 * org session — by invite token, or as the signed-in creator — and must never
 * accidentally return an org's private numbers. Nothing here exposes the agency
 * margin or what the client was charged: a creator sees their fee, and that the
 * money is held.
 */

export interface InviteView {
  deal: Deal;
  creator: Creator;
  campaign: Campaign | null;
  brandName: string;
  /** What the campaign holds in total — evidence the offer is funded. */
  escrowHeldKobo: Kobo;
}

async function demo_getInviteByToken(token: string): Promise<InviteView | null> {
  const deal = DEMO_DEALS.find((d) => d.inviteToken === token);
  if (!deal) return null;

  const creator = DEMO_CREATORS.find((c) => c.id === deal.creatorId);
  if (!creator) return null;

  const campaign = deal.campaignId
    ? (DEMO_CAMPAIGNS.find((c) => c.id === deal.campaignId) ?? null)
    : null;

  return {
    deal,
    creator,
    campaign,
    brandName: campaign?.endBrandName ?? "A brand",
    escrowHeldKobo: campaign
      ? (demoBalances().get(escrowAccountFor(campaign.id)) ?? 0)
      : deal.feeKobo,
  };
}

export interface CreatorDealView {
  deal: Deal;
  campaignName: string | null;
  brandName: string;
  latestDraft: Draft | null;
  /** What the creator will receive, after any fee they agreed to absorb. */
  takeHomeKobo: Kobo;
}

/** The signed-in creator. Demo mode always signs in as Chidera. */
async function demo_getCurrentCreator(): Promise<Creator> {
  return DEMO_CREATORS.find((c) => c.id === "crt_chidera")!;
}

async function demo_getCreatorDeals(creatorId: string): Promise<CreatorDealView[]> {
  return DEMO_DEALS.filter((d) => d.creatorId === creatorId).map((deal) => {
    const campaign = deal.campaignId
      ? (DEMO_CAMPAIGNS.find((c) => c.id === deal.campaignId) ?? null)
      : null;
    const drafts = DEMO_DRAFTS.filter((d) => d.dealId === deal.id).sort(
      (a, b) => b.version - a.version,
    );
    const feeShare =
      deal.feePaidBy === "creator"
        ? Math.floor((deal.feeKobo * deal.platformFeeBps) / 10_000)
        : 0;
    return {
      deal,
      campaignName: campaign?.name ?? null,
      brandName: campaign?.endBrandName ?? "Your own deal",
      latestDraft: drafts[0] ?? null,
      takeHomeKobo: deal.feeKobo - feeShare,
    };
  });
}

async function demo_getCreatorDeal(
  creatorId: string,
  dealId: string,
): Promise<(CreatorDealView & { campaign: Campaign | null }) | null> {
  const views = await getCreatorDeals(creatorId);
  const view = views.find((v) => v.deal.id === dealId);
  if (!view) return null;
  return {
    ...view,
    campaign: view.deal.campaignId
      ? (DEMO_CAMPAIGNS.find((c) => c.id === view.deal.campaignId) ?? null)
      : null,
  };
}

/** The creator's wallet: what has been released, and what is still coming. */
async function demo_getCreatorMoney(creatorId: string) {
  const balances = demoBalances();
  const deals = DEMO_DEALS.filter((d) => d.creatorId === creatorId);

  const availableKobo = balances.get(creatorAccountFor(creatorId)) ?? 0;

  // Work that is signed but not yet released — what they can expect to earn.
  const pendingKobo = deals
    .filter((d) =>
      [
        "contract_signed",
        "draft_submitted",
        "revision_requested",
        "approved",
      ].includes(d.status),
    )
    .reduce((sum, d) => sum + d.feeKobo, 0);

  const paidDeals = deals.filter((d) => d.status === "paid");
  const onTime = paidDeals.filter(
    (d) => d.publishedAt && new Date(d.publishedAt) <= new Date(d.deadline),
  ).length;

  return {
    availableKobo,
    pendingKobo,
    lifetimeKobo: availableKobo,
    dealsCompleted: paidDeals.length,
    onTimeCount: onTime,
    onTimeTotal: paidDeals.length,
  };
}

async function demo_getSpaceName(spaceId: string) {
  return DEMO_SPACES.find((s) => s.id === spaceId)?.name ?? null;
}


/* ==========================================================================
   Which side to read from
   ========================================================================== */

/**
 * The creator surface reads fixtures until Supabase is configured, then reads
 * Postgres — the same arrangement the org queries use, so a screen never knows
 * or cares which it is talking to.
 *
 * This mattered more than it looks: without it a real invite link 404s in
 * production, because the token only ever existed in the demo dataset.
 */

export async function getInviteByToken(token: string) {
  return env.demoMode ? demo_getInviteByToken(token) : live.getInviteByToken(token);
}

export async function getCurrentCreator() {
  return env.demoMode ? demo_getCurrentCreator() : live.getCurrentCreator();
}

export async function getCreatorDeals(creatorId: string) {
  return env.demoMode ? demo_getCreatorDeals(creatorId) : live.getCreatorDeals(creatorId);
}

export async function getCreatorDeal(creatorId: string, dealId: string) {
  return env.demoMode
    ? demo_getCreatorDeal(creatorId, dealId)
    : live.getCreatorDeal(creatorId, dealId);
}

export async function getCreatorMoney(creatorId: string) {
  return env.demoMode ? demo_getCreatorMoney(creatorId) : live.getCreatorMoney(creatorId);
}

export async function getSpaceName(spaceId: string) {
  return env.demoMode ? demo_getSpaceName(spaceId) : live.getSpaceName(spaceId);
}
