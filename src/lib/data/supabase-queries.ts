import "server-only";

import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/session";
import type {
  Brief,
  Campaign,
  CampaignStatus,
  CampaignSummary,
  Creator,
  CreatorProfile,
  CreatorScoreRecord,
  Deal,
  DealMessage,
  DealStatus,
  DealSummary,
  Draft,
  NextAction,
  Org,
  OrgMember,
  Space,
} from "@/lib/domain";
import { fundingRequiredFor } from "@/lib/ledger/transactions";
import type { Kobo } from "@/lib/money";

/**
 * The live read path.
 *
 * Mirrors the demo module function for function, so a screen does not know or
 * care which one it is talking to. Rows are mapped into the domain shapes here
 * rather than passed through raw, which means a column rename touches this file
 * and nothing else.
 *
 * Reads run as the signed-in user, so row-level security decides what comes
 * back. Scoping by org in the query is belt and braces; the database is the
 * belt. Anything that must cross an org boundary — webhooks, ledger posting,
 * background jobs — uses the service client instead, deliberately.
 */

/* ==========================================================================
   Session
   ========================================================================== */

/**
 * The database, as the signed-in user.
 *
 * Every read below goes through this, which means row-level security decides
 * what comes back. Scoping by `org_id` in the query is belt and braces; the
 * database is the belt.
 */
const db = async () => createClient();

async function currentOrgRow() {
  const session = await requireSession();
  return session.org;
}

export async function getCurrentOrg(): Promise<Org> {
  return (await requireSession()).org;
}

export async function getCurrentUser(): Promise<OrgMember> {
  return (await requireSession()).member;
}

/* ==========================================================================
   Spaces and money
   ========================================================================== */

export async function getSpaces(): Promise<Space[]> {
  const org = await currentOrgRow();
  const { data } = await (await db())
    .from("spaces")
    .select("*")
    .eq("org_id", org.id)
    .order("name");
  return (data ?? []).map((s) => ({
    id: s.id,
    orgId: s.org_id,
    name: s.name,
    category: s.category,
    logoUrl: s.logo_url,
    isSelf: s.is_self,
  }));
}

export async function getSpace(spaceId: string): Promise<Space | null> {
  const spaces = await getSpaces();
  return spaces.find((s) => s.id === spaceId) ?? null;
}

/** Every balance for this org in one query, keyed for cheap lookup. */
async function balanceIndex() {
  const org = await currentOrgRow();
  const { data } = await (await db())
    .from("v_balances")
    .select("account_id, kind, space_id, campaign_id, creator_id, balance_kobo");

  const bySpace = new Map<string, Kobo>();
  const byCampaign = new Map<string, Kobo>();
  const byCreator = new Map<string, Kobo>();
  const byAccount = new Map<string, Kobo>();

  for (const row of data ?? []) {
    const amount = Number(row.balance_kobo);
    byAccount.set(row.account_id, amount);
    if (row.kind === "space_wallet" && row.space_id) bySpace.set(row.space_id, amount);
    if (row.kind === "campaign_escrow" && row.campaign_id)
      byCampaign.set(row.campaign_id, amount);
    if (row.kind === "creator_wallet" && row.creator_id)
      byCreator.set(row.creator_id, amount);
  }
  return { org, bySpace, byCampaign, byCreator, byAccount };
}

export async function getBalance(accountId: string): Promise<Kobo> {
  const { byAccount } = await balanceIndex();
  return byAccount.get(accountId) ?? 0;
}

/** The escrow balance for a campaign, which is what screens actually ask for. */
export async function getCampaignEscrow(campaignId: string): Promise<Kobo> {
  const { byCampaign } = await balanceIndex();
  return byCampaign.get(campaignId) ?? 0;
}

export async function getWalletBalances() {
  const [spaces, { bySpace }] = await Promise.all([getSpaces(), balanceIndex()]);
  return spaces.map((space) => ({
    space,
    availableKobo: bySpace.get(space.id) ?? 0,
  }));
}

export async function getOrgMoneySummary() {
  const [spaces, campaigns, { bySpace, byCampaign }] = await Promise.all([
    getSpaces(),
    rawCampaigns(),
    balanceIndex(),
  ]);

  const walletsKobo = spaces.reduce((s, sp) => s + (bySpace.get(sp.id) ?? 0), 0);
  const escrowKobo = campaigns.reduce((s, c) => s + (byCampaign.get(c.id) ?? 0), 0);

  const { data: paidDeals } = await (await db())
    .from("deals")
    .select("fee_kobo, status, campaign_id")
    .in("status", ["paid", "published"])
    .in(
      "campaign_id",
      campaigns.map((c) => c.id),
    );

  const paidOutKobo = (paidDeals ?? []).reduce(
    (s, d) => s + Number(d.fee_kobo),
    0,
  );

  return {
    walletsKobo,
    escrowKobo,
    paidOutKobo,
    totalKobo: walletsKobo + escrowKobo,
  };
}

/* ==========================================================================
   Campaigns
   ========================================================================== */

async function rawCampaigns() {
  const org = await currentOrgRow();
  const { data } = await (await db())
    .from("campaigns")
    .select("*")
    .eq("org_id", org.id)
    .order("created_at", { ascending: false });
  return data ?? [];
}

/**
 * The brief, from storage into the domain.
 *
 * `campaigns.brief` is JSON in snake_case, matching the shape the spec defines
 * and the shape the AI prompts are written against. The domain type is
 * camelCase like everything else in the app. Casting between them type-checks
 * and silently yields undefined at every read, so the conversion is explicit —
 * and tolerant of both spellings, because rows written before this existed
 * are in the database already.
 */
function toBrief(raw: unknown): Brief {
  const b = (raw ?? {}) as Record<string, unknown>;
  const pick = <T,>(snake: string, camel: string, fallback: T): T =>
    (b[snake] as T) ?? (b[camel] as T) ?? fallback;

  const audience = (b.audience ?? {}) as Record<string, unknown>;

  return {
    objective: pick("objective", "objective", "awareness") as Brief["objective"],
    product: pick("product", "product", ""),
    keyMessages: pick<string[]>("key_messages", "keyMessages", []),
    mustInclude: pick<string[]>("must_include", "mustInclude", []),
    mustAvoid: pick<string[]>("must_avoid", "mustAvoid", []),
    audience: {
      ageRange: ((audience.age_range ?? audience.ageRange) as [number, number]) ?? [18, 44],
      gender: ((audience.gender as Brief["audience"]["gender"]) ?? "any"),
      cities: (audience.cities as string[]) ?? [],
      languages: (audience.languages as string[]) ?? ["English"],
    },
    platforms: pick<string[]>("platforms", "platforms", []),
    tone: pick("tone", "tone", ""),
    disclosureTag: pick("disclosure_tag", "disclosureTag", "#ad"),
    arconCategory: pick("arcon_category", "arconCategory", "general") as Brief["arconCategory"],
    usageRightsDays: Number(pick("usage_rights_days", "usageRightsDays", 90)),
  };
}

function toCampaign(row: Record<string, unknown>): Campaign {
  return {
    id: row.id as string,
    spaceId: row.space_id as string,
    orgId: row.org_id as string,
    name: row.name as string,
    endBrandName: row.end_brand_name as string,
    status: row.status as CampaignStatus,
    budgetKobo: Number(row.budget_kobo),
    platformFeeBps: Number(row.platform_fee_bps),
    agencyMarginBps:
      row.agency_margin_bps === null ? null : Number(row.agency_margin_bps),
    arconCategory: row.arcon_category as Campaign["arconCategory"],
    brief: toBrief(row.brief),
    rateBandMinKobo: Number(row.rate_band_min_kobo ?? 0),
    rateBandMaxKobo: Number(row.rate_band_max_kobo ?? 0),
    deadline: row.deadline as string,
    createdAt: row.created_at as string,
  };
}

export async function getCampaign(campaignId: string): Promise<Campaign | null> {
  const { data } = await (await db())
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .maybeSingle();
  return data ? toCampaign(data) : null;
}

export async function getCampaignSummaries(): Promise<CampaignSummary[]> {
  const [rows, spaces, { byCampaign }] = await Promise.all([
    rawCampaigns(),
    getSpaces(),
    balanceIndex(),
  ]);
  const spaceNames = new Map(spaces.map((s) => [s.id, s.name]));
  const ids = rows.map((r) => r.id);

  const [{ data: deals }, { data: slots }, { data: shortlist }, { data: pendingMsgs }] =
    await Promise.all([
      (await db()).from("deals").select("*").in("campaign_id", ids),
      (await db()).from("campaign_slots").select("*").in("campaign_id", ids),
      (await db())
        .from("shortlist_items")
        .select("campaign_id, status")
        .in("campaign_id", ids)
        .eq("status", "proposed"),
      (await db())
        .from("deal_messages")
        .select("deal_id, ai_draft, sent_at")
        .eq("ai_draft", true)
        .is("sent_at", null),
    ]);

  const pendingDealIds = new Set((pendingMsgs ?? []).map((m) => m.deal_id));

  return rows.map((row) => {
    const campaign = toCampaign(row);
    const campaignDeals = (deals ?? []).filter((d) => d.campaign_id === campaign.id);
    const slot = (slots ?? []).find((s) => s.campaign_id === campaign.id);
    const proposed = (shortlist ?? []).filter(
      (s) => s.campaign_id === campaign.id,
    ).length;

    const confirmed = campaignDeals.filter((d) =>
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
      spaceName: spaceNames.get(campaign.spaceId) ?? "—",
      creatorsConfirmed: confirmed,
      creatorsTarget: slot ? Number(slot.count) : 0,
      escrowHeldKobo: byCampaign.get(campaign.id) ?? 0,
      paidOutKobo: campaignDeals
        .filter((d) => d.status === "paid" || d.status === "published")
        .reduce((s, d) => s + Number(d.fee_kobo), 0),
      nextAction: nextActionFor(campaign, campaignDeals, proposed, slot, pendingDealIds),
    };
  });
}

function nextActionFor(
  campaign: Campaign,
  deals: Record<string, unknown>[],
  proposedCount: number,
  slot: Record<string, unknown> | undefined,
  pendingDealIds: Set<string>,
): NextAction | null {
  if (campaign.status === "draft") {
    const fees = slot
      ? Number(slot.fee_kobo) * Number(slot.count)
      : campaign.budgetKobo;
    const required = fees > 0 ? fundingRequiredFor(fees, campaign.platformFeeBps) : 0;
    return {
      label: "Fund this campaign to start outreach",
      detail: `${campaign.endBrandName} · needs funding before anyone is contacted`,
      href: `/campaigns/${campaign.id}/fund`,
      tone: "warn",
      urgency: 100 + required / 1_000_000,
    };
  }

  if (proposedCount > 0) {
    return {
      label: `Approve a shortlist of ${proposedCount} creators`,
      detail: `${campaign.endBrandName} · escrow is funded and waiting`,
      href: `/campaigns/${campaign.id}/shortlist`,
      tone: "warn",
      urgency: 90,
    };
  }

  const awaiting = deals.filter((d) => d.status === "draft_submitted").length;
  if (awaiting > 0) {
    return {
      label: `Review ${awaiting} draft${awaiting > 1 ? "s" : ""} that passed the brief check`,
      detail: `${campaign.endBrandName} · creator is waiting on you`,
      href: `/campaigns/${campaign.id}?tab=content`,
      tone: "info",
      urgency: 80,
    };
  }

  const pending = deals.filter((d) => pendingDealIds.has(d.id as string)).length;
  if (pending > 0) {
    return {
      label: `Approve ${pending} message${pending > 1 ? "s" : ""} before it sends`,
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

  return null;
}

export async function getCampaignSummary(
  campaignId: string,
): Promise<CampaignSummary | null> {
  const all = await getCampaignSummaries();
  return all.find((s) => s.campaign.id === campaignId) ?? null;
}

export async function getNeedsAction() {
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
   Creators and deals
   ========================================================================== */

function toCreator(row: Record<string, unknown>): Creator {
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

function toProfile(row: Record<string, unknown>): CreatorProfile {
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

function toScore(row: Record<string, unknown>): CreatorScoreRecord {
  return {
    id: row.id as string,
    creatorId: row.creator_id as string,
    campaignId: (row.campaign_id as string) ?? null,
    fraudScore: Number(row.fraud_score),
    reasons: (row.reasons as CreatorScoreRecord["reasons"]) ?? [],
    computedAt: row.computed_at as string,
  };
}

function toDeal(row: Record<string, unknown>): Deal {
  return {
    id: row.id as string,
    campaignId: (row.campaign_id as string) ?? null,
    creatorId: row.creator_id as string,
    slotId: (row.slot_id as string) ?? null,
    origin: row.origin as Deal["origin"],
    feeKobo: Number(row.fee_kobo),
    platformFeeBps: Number(row.platform_fee_bps),
    feePaidBy: row.fee_paid_by as Deal["feePaidBy"],
    status: row.status as DealStatus,
    deadline: row.deadline as string,
    inviteToken: row.invite_token as string,
    brandApprovalToken: (row.brand_approval_token as string) ?? null,
    contractPdfUrl: (row.contract_pdf_url as string) ?? null,
    contractAcceptedAt: (row.contract_accepted_at as string) ?? null,
    publishedUrl: (row.published_url as string) ?? null,
    publishedAt: (row.published_at as string) ?? null,
    autoConfirmAt: (row.auto_confirm_at as string) ?? null,
    createdAt: row.created_at as string,
  };
}

async function summarise(dealRows: Record<string, unknown>[]): Promise<DealSummary[]> {
  if (dealRows.length === 0) return [];
  const creatorIds = [...new Set(dealRows.map((d) => d.creator_id as string))];
  const campaignIds = [
    ...new Set(dealRows.map((d) => d.campaign_id as string).filter(Boolean)),
  ];

  const [{ data: creators }, { data: profiles }, { data: scores }, { data: campaigns }] =
    await Promise.all([
      (await db()).from("creators").select("*").in("id", creatorIds),
      (await db()).from("creator_profiles").select("*").in("creator_id", creatorIds),
      (await db()).from("creator_scores").select("*").in("creator_id", creatorIds),
      campaignIds.length
        ? (await db()).from("campaigns").select("*").in("id", campaignIds)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    ]);

  const creatorById = new Map((creators ?? []).map((c) => [c.id, toCreator(c)]));
  const profileByCreator = new Map(
    (profiles ?? []).map((p) => [p.creator_id, toProfile(p)]),
  );
  const scoreByCreator = new Map((scores ?? []).map((s) => [s.creator_id, toScore(s)]));
  const campaignById = new Map(
    (campaigns ?? []).map((c) => [c.id as string, toCampaign(c)]),
  );

  return dealRows.map((row) => {
    const deal = toDeal(row);
    const campaign = deal.campaignId ? campaignById.get(deal.campaignId) : null;
    return {
      deal,
      creator: creatorById.get(deal.creatorId)!,
      profile: profileByCreator.get(deal.creatorId) ?? null,
      score: scoreByCreator.get(deal.creatorId) ?? null,
      campaignName: campaign?.name ?? null,
      endBrandName: campaign?.endBrandName ?? null,
    };
  });
}

export async function getDealsForCampaign(campaignId: string): Promise<DealSummary[]> {
  const { data } = await (await db())
    .from("deals")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at");
  return summarise(data ?? []);
}

export async function getDeal(dealId: string): Promise<DealSummary | null> {
  const { data } = await (await db()).from("deals").select("*").eq("id", dealId).maybeSingle();
  if (!data) return null;
  return (await summarise([data]))[0] ?? null;
}

function toMessage(row: Record<string, unknown>): DealMessage {
  return {
    id: row.id as string,
    dealId: row.deal_id as string,
    direction: row.direction as DealMessage["direction"],
    channel: row.channel as DealMessage["channel"],
    body: row.body as string,
    aiDraft: Boolean(row.ai_draft),
    approvedBy: (row.approved_by as string) ?? null,
    sentAt: (row.sent_at as string) ?? null,
    createdAt: row.created_at as string,
  };
}

export async function getMessagesForCampaign(campaignId: string) {
  const { data: deals } = await (await db())
    .from("deals")
    .select("*")
    .eq("campaign_id", campaignId);
  const summaries = await summarise(deals ?? []);
  const byId = new Map(summaries.map((s) => [s.deal.id, s]));

  const { data: messages } = await (await db())
    .from("deal_messages")
    .select("*")
    .in(
      "deal_id",
      summaries.map((s) => s.deal.id),
    )
    .order("created_at");

  return (messages ?? [])
    .filter((m) => byId.has(m.deal_id))
    .map((m) => ({ message: toMessage(m), deal: byId.get(m.deal_id)! }));
}

function toDraft(row: Record<string, unknown>): Draft {
  return {
    id: row.id as string,
    dealId: row.deal_id as string,
    version: Number(row.version),
    fileUrl: row.file_url as string,
    caption: (row.caption as string) ?? "",
    submittedAt: row.submitted_at as string,
    aiReview: (row.ai_review as Draft["aiReview"]) ?? null,
    reviewerDecision: (row.reviewer_decision as Draft["reviewerDecision"]) ?? null,
    reviewerNotes: (row.reviewer_notes as string) ?? null,
  };
}

export async function getDraftsForCampaign(campaignId: string) {
  const { data: deals } = await (await db())
    .from("deals")
    .select("*")
    .eq("campaign_id", campaignId);
  const summaries = await summarise(deals ?? []);
  const byId = new Map(summaries.map((s) => [s.deal.id, s]));

  const { data: drafts } = await (await db())
    .from("drafts")
    .select("*")
    .in(
      "deal_id",
      summaries.map((s) => s.deal.id),
    )
    .order("version", { ascending: false });

  return (drafts ?? [])
    .filter((d) => byId.has(d.deal_id))
    .map((d) => ({ draft: toDraft(d), deal: byId.get(d.deal_id)! }));
}

export async function getPendingMessageDrafts() {
  const { data: messages } = await (await db())
    .from("deal_messages")
    .select("*")
    .eq("ai_draft", true)
    .is("sent_at", null)
    .order("created_at", { ascending: false });

  if (!messages?.length) return [];

  const { data: deals } = await (await db())
    .from("deals")
    .select("*")
    .in("id", [...new Set(messages.map((m) => m.deal_id))]);
  const summaries = await summarise(deals ?? []);
  const byId = new Map(summaries.map((s) => [s.deal.id, s]));

  return messages
    .filter((m) => byId.has(m.deal_id))
    .map((m) => ({ message: toMessage(m), deal: byId.get(m.deal_id)! }));
}

export async function getShortlist(campaignId: string) {
  const { data: items } = await (await db())
    .from("shortlist_items")
    .select("*")
    .eq("campaign_id", campaignId)
    .neq("status", "removed")
    .order("fit_score", { ascending: false });

  if (!items?.length) return [];

  const creatorIds = items.map((i) => i.creator_id);
  const [{ data: creators }, { data: profiles }, { data: scores }] = await Promise.all([
    (await db()).from("creators").select("*").in("id", creatorIds),
    (await db()).from("creator_profiles").select("*").in("creator_id", creatorIds),
    (await db()).from("creator_scores").select("*").in("creator_id", creatorIds),
  ]);

  const creatorById = new Map((creators ?? []).map((c) => [c.id, toCreator(c)]));
  const profileByCreator = new Map(
    (profiles ?? []).map((p) => [p.creator_id, toProfile(p)]),
  );
  const scoreByCreator = new Map((scores ?? []).map((s) => [s.creator_id, toScore(s)]));

  return items.map((item) => ({
    item: {
      id: item.id,
      campaignId: item.campaign_id,
      creatorId: item.creator_id,
      slotId: item.slot_id,
      aiReasoning: item.ai_reasoning,
      fitScore: Number(item.fit_score),
      estimatedFeeKobo: Number(item.estimated_fee_kobo),
      status: item.status,
    },
    creator: creatorById.get(item.creator_id)!,
    profile: profileByCreator.get(item.creator_id) ?? null,
    score: scoreByCreator.get(item.creator_id) ?? null,
  }));
}

export async function getCreators() {
  const [{ data: creators }, { data: profiles }, { data: scores }, { byCreator }] =
    await Promise.all([
      (await db()).from("creators").select("*").order("display_name"),
      (await db()).from("creator_profiles").select("*"),
      (await db()).from("creator_scores").select("*"),
      balanceIndex(),
    ]);

  const { data: deals } = await (await db()).from("deals").select("creator_id");
  const dealCounts = new Map<string, number>();
  for (const d of deals ?? []) {
    dealCounts.set(d.creator_id, (dealCounts.get(d.creator_id) ?? 0) + 1);
  }

  const profileByCreator = new Map(
    (profiles ?? []).map((p) => [p.creator_id, toProfile(p)]),
  );
  const scoreByCreator = new Map((scores ?? []).map((s) => [s.creator_id, toScore(s)]));

  return (creators ?? []).map((row) => {
    const creator = toCreator(row);
    return {
      creator,
      profile: profileByCreator.get(creator.id) ?? null,
      score: scoreByCreator.get(creator.id) ?? null,
      dealsCount: dealCounts.get(creator.id) ?? 0,
      earnedKobo: byCreator.get(creator.id) ?? 0,
    };
  });
}

export async function getTransactions(limit = 50) {
  const { data: transactions } = await (await db())
    .from("ledger_transactions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!transactions?.length) return [];

  const { data: entries } = await (await db())
    .from("ledger_entries")
    .select("transaction_id, account_id, amount_kobo")
    .in(
      "transaction_id",
      transactions.map((t) => t.id),
    );

  const { data: accounts } = await (await db())
    .from("ledger_accounts")
    .select("id, kind, org_id, space_id, creator_id, campaign_id, deal_id, currency");
  const accountById = new Map((accounts ?? []).map((a) => [a.id, a]));

  return transactions.map((t) => {
    const txEntries = (entries ?? [])
      .filter((e) => e.transaction_id === t.id)
      .map((e) => ({ accountId: e.account_id, amountKobo: Number(e.amount_kobo) }));
    return {
      transaction: {
        id: t.id,
        type: t.type,
        reference: t.reference,
        memo: t.memo,
        createdBy: t.created_by,
        createdAt: t.created_at,
        entries: txEntries,
      },
      accounts: txEntries.map((e) => {
        const a = accountById.get(e.accountId);
        return a
          ? {
              id: a.id,
              orgId: a.org_id,
              spaceId: a.space_id,
              creatorId: a.creator_id,
              campaignId: a.campaign_id,
              dealId: a.deal_id,
              kind: a.kind,
              currency: a.currency as "NGN",
            }
          : null;
      }),
    };
  });
}

export const NOW = new Date();
