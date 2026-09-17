import "server-only";

import {
  creatorAccountFor,
  DEMO_ACCOUNTS,
  DEMO_CAMPAIGNS,
  DEMO_CREATORS,
  DEMO_DEALS,
  DEMO_DRAFTS,
  DEMO_MESSAGES,
  DEMO_MEMBERS,
  DEMO_NOW,
  DEMO_ORG,
  DEMO_PROFILES,
  DEMO_SCORES,
  DEMO_SHORTLIST,
  DEMO_SLOTS,
  DEMO_SPACES,
  DEMO_TRANSACTIONS,
  demoBalances,
  escrowAccountFor,
  walletAccountFor,
} from "@/lib/demo/data";
import type {
  Campaign,
  CampaignSummary,
  Creator,
  DealSummary,
  NextAction,
  Space,
} from "@/lib/domain";
import { fundingRequiredFor } from "@/lib/ledger/transactions";
import type { Kobo } from "@/lib/money";

/**
 * Read models for the org app.
 *
 * Every screen asks for the shape it renders rather than for tables, so the
 * work of joining campaigns to deals to balances happens once, here, on the
 * server. When Supabase is configured these become queries against Postgres;
 * the signatures do not change.
 */

const balances = () => demoBalances();

export async function getCurrentOrg() {
  return DEMO_ORG;
}

export async function getCurrentUser() {
  return DEMO_MEMBERS[0];
}

export async function getSpaces(): Promise<Space[]> {
  return DEMO_SPACES.filter((s) => s.orgId === DEMO_ORG.id);
}

export async function getSpace(spaceId: string): Promise<Space | null> {
  return DEMO_SPACES.find((s) => s.id === spaceId) ?? null;
}

/** Balance of one ledger account, summed from its entries. */
export async function getBalance(accountId: string): Promise<Kobo> {
  return balances().get(accountId) ?? 0;
}

/** Every space wallet for the org, with what each holds. */
export async function getWalletBalances() {
  const b = balances();
  const spaces = await getSpaces();
  return spaces.map((space) => ({
    space,
    availableKobo: b.get(walletAccountFor(space.id)) ?? 0,
  }));
}

/** What the org holds across every wallet and every campaign escrow. */
export async function getOrgMoneySummary() {
  const b = balances();
  const spaces = await getSpaces();

  const walletsKobo = spaces.reduce(
    (sum, s) => sum + (b.get(walletAccountFor(s.id)) ?? 0),
    0,
  );
  const escrowKobo = DEMO_CAMPAIGNS.reduce(
    (sum, c) => sum + (b.get(escrowAccountFor(c.id)) ?? 0),
    0,
  );

  // Paid out is what has actually reached creators from this org's campaigns.
  const campaignIds = new Set(DEMO_CAMPAIGNS.map((c) => c.id));
  const paidOutKobo = DEMO_DEALS.filter(
    (d) => d.campaignId && campaignIds.has(d.campaignId),
  )
    .filter((d) => d.status === "paid" || d.status === "published")
    .reduce((sum, d) => sum + d.feeKobo, 0);

  return {
    walletsKobo,
    escrowKobo,
    paidOutKobo,
    /** Held in escrow plus sitting in wallets — the org's money on the platform. */
    totalKobo: walletsKobo + escrowKobo,
  };
}

/* ==========================================================================
   Campaigns
   ========================================================================== */

const TARGET_BY_CAMPAIGN = new Map(
  DEMO_SLOTS.map((s) => [s.campaignId, s.count]),
);

/**
 * The single thing a campaign needs from a person right now.
 *
 * The board is built around this rather than around status: "shortlisting" is a
 * state, but "approve 4 creators" is a decision someone can make in ten seconds.
 * Urgency orders the list — money that cannot move ranks above work that is
 * merely waiting.
 */
function nextActionFor(campaign: Campaign, deals: typeof DEMO_DEALS): NextAction | null {
  const b = balances();

  if (campaign.status === "draft") {
    const slot = DEMO_SLOTS.find((s) => s.campaignId === campaign.id);
    const fees = slot ? slot.feeKobo * slot.count : campaign.budgetKobo;
    const required = fundingRequiredFor(fees, campaign.platformFeeBps);
    return {
      label: "Fund this campaign to start outreach",
      detail: `${campaign.endBrandName} · needs funding before anyone is contacted`,
      href: `/campaigns/${campaign.id}/fund`,
      tone: "warn",
      urgency: 100 + required / 1_000_000,
    };
  }

  const proposed = DEMO_SHORTLIST.filter(
    (s) => s.campaignId === campaign.id && s.status === "proposed",
  ).length;
  if (proposed > 0) {
    return {
      label: `Approve a shortlist of ${proposed} creators`,
      detail: `${campaign.endBrandName} · escrow is funded and waiting`,
      href: `/campaigns/${campaign.id}/shortlist`,
      tone: "warn",
      urgency: 90,
    };
  }

  // Funded, and nobody picked yet. See the note in supabase-queries.ts: without
  // this the campaign has no next step after funding at all.
  if (deals.length === 0) {
    return {
      label: "Build the shortlist",
      detail: `${campaign.endBrandName} · escrow is funded, nobody contacted yet`,
      href: `/campaigns/${campaign.id}/shortlist`,
      tone: "warn",
      urgency: 95,
    };
  }

  const awaitingReview = deals.filter((d) => d.status === "draft_submitted").length;
  if (awaitingReview > 0) {
    return {
      label: `Review ${awaitingReview} draft${awaitingReview > 1 ? "s" : ""} that passed the brief check`,
      detail: `${campaign.endBrandName} · creator is waiting on you`,
      href: `/campaigns/${campaign.id}?tab=content`,
      tone: "info",
      urgency: 80,
    };
  }

  const pendingDrafts = DEMO_MESSAGES.filter(
    (m) =>
      m.aiDraft &&
      !m.sentAt &&
      deals.some((d) => d.id === m.dealId),
  ).length;
  if (pendingDrafts > 0) {
    return {
      label: `Approve ${pendingDrafts} message${pendingDrafts > 1 ? "s" : ""} before it sends`,
      detail: `${campaign.endBrandName} · drafted by AI, not yet sent`,
      href: `/campaigns/${campaign.id}?tab=messages`,
      tone: "info",
      urgency: 70,
    };
  }

  const published = deals.filter((d) => d.status === "published").length;
  if (published > 0) {
    return {
      label: `Release payment on ${published} published post${published > 1 ? "s" : ""}`,
      detail: `${campaign.endBrandName} · verified and ready to pay`,
      href: `/campaigns/${campaign.id}?tab=results`,
      tone: "neutral",
      urgency: 60,
    };
  }

  const escrow = b.get(escrowAccountFor(campaign.id)) ?? 0;
  if (campaign.status === "completed" && escrow > 0) {
    return {
      label: "Return unused budget to the wallet",
      detail: `${campaign.endBrandName} · campaign is finished`,
      href: `/campaigns/${campaign.id}`,
      tone: "neutral",
      urgency: 40,
    };
  }

  return null;
}

export async function getCampaignSummaries(): Promise<CampaignSummary[]> {
  const b = balances();
  const spacesById = new Map(DEMO_SPACES.map((s) => [s.id, s]));

  return DEMO_CAMPAIGNS.map((campaign) => {
    const deals = DEMO_DEALS.filter((d) => d.campaignId === campaign.id);
    const confirmed = deals.filter((d) =>
      [
        "contract_signed",
        "draft_submitted",
        "revision_requested",
        "approved",
        "published",
        "paid",
      ].includes(d.status),
    ).length;

    return {
      campaign,
      spaceName: spacesById.get(campaign.spaceId)?.name ?? "—",
      creatorsConfirmed: confirmed,
      creatorsTarget: TARGET_BY_CAMPAIGN.get(campaign.id) ?? 0,
      escrowHeldKobo: b.get(escrowAccountFor(campaign.id)) ?? 0,
      paidOutKobo: deals
        .filter((d) => d.status === "paid" || d.status === "published")
        .reduce((sum, d) => sum + d.feeKobo, 0),
      nextAction: nextActionFor(campaign, deals),
    };
  });
}

export async function getCampaign(campaignId: string): Promise<Campaign | null> {
  return DEMO_CAMPAIGNS.find((c) => c.id === campaignId) ?? null;
}

export async function getCampaignSummary(
  campaignId: string,
): Promise<CampaignSummary | null> {
  const all = await getCampaignSummaries();
  return all.find((s) => s.campaign.id === campaignId) ?? null;
}

/** The "needs your action" list, most urgent first. */
export async function getNeedsAction(): Promise<
  (NextAction & { campaignId: string; campaignName: string })[]
> {
  const summaries = await getCampaignSummaries();
  return summaries
    .filter((s) => s.nextAction)
    .map((s) => ({
      ...s.nextAction!,
      campaignId: s.campaign.id,
      campaignName: s.campaign.name,
    }))
    .sort((a, b) => b.urgency - a.urgency);
}

/* ==========================================================================
   Deals, creators, drafts
   ========================================================================== */

function summariseDeal(deal: (typeof DEMO_DEALS)[number]): DealSummary {
  const creator = DEMO_CREATORS.find((c) => c.id === deal.creatorId)!;
  const campaign = deal.campaignId
    ? DEMO_CAMPAIGNS.find((c) => c.id === deal.campaignId) ?? null
    : null;
  return {
    deal,
    creator,
    profile: DEMO_PROFILES.find((p) => p.creatorId === deal.creatorId) ?? null,
    score: DEMO_SCORES.find((s) => s.creatorId === deal.creatorId) ?? null,
    campaignName: campaign?.name ?? null,
    endBrandName: campaign?.endBrandName ?? null,
  };
}

export async function getDealsForCampaign(campaignId: string): Promise<DealSummary[]> {
  return DEMO_DEALS.filter((d) => d.campaignId === campaignId).map(summariseDeal);
}

export async function getDeal(dealId: string): Promise<DealSummary | null> {
  const deal = DEMO_DEALS.find((d) => d.id === dealId);
  return deal ? summariseDeal(deal) : null;
}

export async function getMessagesForCampaign(campaignId: string) {
  const dealIds = new Set(
    DEMO_DEALS.filter((d) => d.campaignId === campaignId).map((d) => d.id),
  );
  return DEMO_MESSAGES.filter((m) => dealIds.has(m.dealId)).map((message) => ({
    message,
    deal: summariseDeal(DEMO_DEALS.find((d) => d.id === message.dealId)!),
  }));
}

export async function getDraftsForCampaign(campaignId: string) {
  const dealIds = new Set(
    DEMO_DEALS.filter((d) => d.campaignId === campaignId).map((d) => d.id),
  );
  return DEMO_DRAFTS.filter((d) => dealIds.has(d.dealId)).map((draft) => ({
    draft,
    deal: summariseDeal(DEMO_DEALS.find((d) => d.id === draft.dealId)!),
  }));
}

/** AI-written messages waiting on a person. This is the ops inbox. */
export async function getPendingMessageDrafts() {
  return DEMO_MESSAGES.filter((m) => m.aiDraft && !m.sentAt).map((message) => ({
    message,
    deal: summariseDeal(DEMO_DEALS.find((d) => d.id === message.dealId)!),
  }));
}

export async function getShortlist(campaignId: string) {
  return DEMO_SHORTLIST.filter((s) => s.campaignId === campaignId).map((item) => ({
    item,
    creator: DEMO_CREATORS.find((c) => c.id === item.creatorId)!,
    profile: DEMO_PROFILES.find((p) => p.creatorId === item.creatorId) ?? null,
    score: DEMO_SCORES.find((s) => s.creatorId === item.creatorId) ?? null,
  }));
}

export async function getCreators(): Promise<
  {
    creator: Creator;
    profile: (typeof DEMO_PROFILES)[number] | null;
    score: (typeof DEMO_SCORES)[number] | null;
    dealsCount: number;
    earnedKobo: Kobo;
  }[]
> {
  const b = balances();
  return DEMO_CREATORS.map((creator) => {
    const deals = DEMO_DEALS.filter((d) => d.creatorId === creator.id);
    return {
      creator,
      profile: DEMO_PROFILES.find((p) => p.creatorId === creator.id) ?? null,
      score: DEMO_SCORES.find((s) => s.creatorId === creator.id) ?? null,
      dealsCount: deals.length,
      earnedKobo: b.get(creatorAccountFor(creator.id)) ?? 0,
    };
  });
}

export async function getTransactions(limit = 50) {
  const accountsById = new Map(DEMO_ACCOUNTS.map((a) => [a.id, a]));
  return [...DEMO_TRANSACTIONS]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit)
    .map((tx) => ({
      transaction: tx,
      accounts: tx.entries.map((e) => accountsById.get(e.accountId) ?? null),
    }));
}

export const NOW = DEMO_NOW;

/** The fixture mirror of the live creator profile. Same shape, same fields. */
export async function getCreatorDetail(creatorId: string) {
  const creator = DEMO_CREATORS.find((c) => c.id === creatorId);
  if (!creator) return null;

  const deals = DEMO_DEALS.filter((d) => d.creatorId === creatorId);
  const history = deals.map((d) => {
    const campaign = DEMO_CAMPAIGNS.find((c) => c.id === d.campaignId);
    return {
      id: d.id,
      status: d.status,
      feeKobo: d.feeKobo,
      deadline: d.deadline ?? null,
      publishedAt: d.publishedAt ?? null,
      publishedUrl: d.publishedUrl ?? null,
      campaignId: campaign?.id ?? null,
      campaignName: campaign?.name ?? "Direct deal",
      brandName: campaign?.endBrandName ?? null,
    };
  });

  const finished = history.filter((d) => ["published", "paid"].includes(d.status));
  const missed = history.filter((d) => d.status === "cancelled");
  const onTime = finished.filter(
    (d) => !d.deadline || !d.publishedAt || d.publishedAt <= d.deadline,
  );

  return {
    creator,
    profile: DEMO_PROFILES.find((p) => p.creatorId === creatorId) ?? null,
    score: DEMO_SCORES.find((s) => s.creatorId === creatorId) ?? null,
    history,
    record: {
      completed: finished.length,
      missed: missed.length,
      onTime: onTime.length,
      earnedKobo: finished.reduce((s, d) => s + d.feeKobo, 0),
    },
  };
}

/** The fixture team: the demo members, and never any pending invitations. */
export async function getTeam() {
  return {
    members: DEMO_MEMBERS.map((m) => ({
      id: m.userId,
      role: m.role as string,
      email: m.email,
      name: m.name,
    })),
    invites: [] as { id: string; email: string; role: string; expiresAt: string }[],
  };
}

/** The fixture pipeline. Same shape as the live one. */
export async function getAllDeals() {
  return DEMO_DEALS.map((d) => {
    const creator = DEMO_CREATORS.find((c) => c.id === d.creatorId);
    const campaign = DEMO_CAMPAIGNS.find((c) => c.id === d.campaignId);
    return {
      id: d.id,
      status: d.status,
      feeKobo: d.feeKobo,
      deadline: d.deadline ?? null,
      publishedAt: d.publishedAt ?? null,
      proposedFeeKobo: null as number | null,
      creatorId: d.creatorId,
      creatorName: creator?.displayName ?? "A creator",
      creatorHandle: creator?.handle ?? "",
      campaignId: campaign?.id ?? null,
      campaignName: campaign?.name ?? "Direct deal",
      brandName: campaign?.endBrandName ?? "",
    };
  });
}
