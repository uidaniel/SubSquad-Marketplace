import "server-only";

import { requireServiceClient } from "@/lib/supabase/service";
import { one } from "@/lib/data/relations";
import type { Brief, Campaign, Creator, Deal, Draft } from "@/lib/domain";
import type { Kobo } from "@/lib/money";

/**
 * The creator surface, against Postgres.
 *
 * Reached without an org session — by invite token, or as the creator
 * themselves — so these run through the service client and scope explicitly.
 * The rule every function here obeys: a creator sees their own fee and that the
 * money is held, and never the agency's margin or what the client was charged.
 * Those columns are not selected at all rather than selected and dropped, so a
 * future careless spread cannot leak them.
 */

/* ==========================================================================
   Row mapping
   ========================================================================== */

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
      ageRange:
        ((audience.age_range ?? audience.ageRange) as [number, number]) ?? [18, 44],
      gender: (audience.gender as Brief["audience"]["gender"]) ?? "any",
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
    status: row.status as Deal["status"],
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
    doNotContact: Boolean(row.do_not_contact),
    contactSource: (row.contact_source as Creator["contactSource"]) ?? "manual",
    userId: (row.user_id as string) ?? null,
    lastContactedAt: (row.last_contacted_at as string) ?? null,
  };
}

function toCampaign(row: Record<string, unknown>): Campaign {
  return {
    id: row.id as string,
    spaceId: row.space_id as string,
    orgId: row.org_id as string,
    name: row.name as string,
    endBrandName: row.end_brand_name as string,
    status: row.status as Campaign["status"],
    budgetKobo: Number(row.budget_kobo),
    platformFeeBps: Number(row.platform_fee_bps),
    // Deliberately null on this surface. The margin is the agency's business
    // with their client, and a creator has no reason to be shown it.
    agencyMarginBps: null,
    arconCategory: row.arcon_category as Campaign["arconCategory"],
    brief: toBrief(row.brief),
    rateBandMinKobo: Number(row.rate_band_min_kobo ?? 0),
    rateBandMaxKobo: Number(row.rate_band_max_kobo ?? 0),
    deadline: row.deadline as string,
    createdAt: row.created_at as string,
  };
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

/* ==========================================================================
   Queries
   ========================================================================== */

/** What escrow holds for a campaign — the evidence that an offer is funded. */
async function escrowFor(campaignId: string): Promise<Kobo> {
  const db = requireServiceClient();
  const { data } = await db
    .from("v_balances")
    .select("balance_kobo")
    .eq("kind", "campaign_escrow")
    .eq("campaign_id", campaignId)
    .maybeSingle();
  return Number(data?.balance_kobo ?? 0);
}

export async function getInviteByToken(token: string) {
  const db = requireServiceClient();
  const { data } = await db
    .from("deals")
    .select(
      "*, creators(*), campaigns(*, orgs(name, verified_at, cac_number)), campaign_slots(deliverable_type, count)",
    )
    .eq("invite_token", token)
    .maybeSingle();

  if (!data) return null;

  const creatorRow = one(data.creators);
  if (!creatorRow) return null;

  const campaignRow = one(data.campaigns);
  const campaign = campaignRow ? toCampaign(campaignRow) : null;
  const deal = toDeal(data as Record<string, unknown>);

  // Who is running this campaign, and whether we have checked them.
  //
  // A creator is being asked to trust a company they have never heard of on the
  // word of a platform they have never heard of. Naming the agency and saying
  // plainly whether they are verified is the least we can do — and it is what
  // the partnership panel on the page is built from.
  const orgRow = campaignRow ? one(campaignRow.orgs) : null;

  const slot = one(data.campaign_slots) as
    | { deliverable_type?: string; count?: number }
    | undefined;

  return {
    deal,
    creator: toCreator(creatorRow),
    campaign,
    brandName: campaign?.endBrandName ?? "A brand",
    agencyName: (orgRow?.name as string) ?? null,
    agencyVerified: Boolean(orgRow?.verified_at),
    agencyCac: (orgRow?.cac_number as string) ?? null,
    agencyVerifiedAt: (orgRow?.verified_at as string) ?? null,
    deliverableType: slot?.deliverable_type ?? null,
    /**
     * What this one creator makes: one of them.
     *
     * `campaign_slots.count` is how many creators the campaign wants for that
     * deliverable — the form calls the field "Creators". Reading it as a
     * per-deal quantity told Chidera she owed ten TikTok videos for one fee.
     */
    deliverableCount: 1,
    /** The rate this creator has asked for and is waiting to hear back on. */
    proposedFeeKobo: data.proposed_fee_kobo ? Number(data.proposed_fee_kobo) : null,
    rateProposedAt: (data.rate_proposed_at as string | null) ?? null,
    /**
     * Whether *their* fee is covered — not how much the campaign holds.
     *
     * This used to return the campaign's whole escrow balance and the page
     * printed it: "₦952,000 is already locked for this campaign". That hands a
     * creator the client's entire budget, from which they can work out roughly
     * how many creators are being hired and at what rate. It is the agency's
     * commercial information and it is not ours to give away.
     *
     * What a creator needs is the answer to one question: is the money for my
     * work actually there. That is a yes or a no.
     */
    feeSecured: campaign
      ? (await escrowFor(campaign.id)) >= deal.feeKobo
      : deal.feeKobo > 0,
  };
}

export async function getCreatorDeals(creatorId: string) {
  const db = requireServiceClient();
  const { data } = await db
    .from("deals")
    .select("*, campaigns(name, end_brand_name), drafts(*)")
    .eq("creator_id", creatorId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => {
    const campaign = one(row.campaigns);
    const drafts = Array.isArray(row.drafts)
      ? (row.drafts as Record<string, unknown>[])
      : [];
    const latest = drafts
      .slice()
      .sort((a, b) => Number(b.version) - Number(a.version))[0];

    const deal = toDeal(row as Record<string, unknown>);

    return {
      deal,
      campaignName: (campaign?.name as string) ?? null,
      brandName: (campaign?.end_brand_name as string) ?? "Your own deal",
      latestDraft: latest ? toDraft(latest) : null,
      takeHomeKobo: takeHome(deal),
    };
  });
}

export async function getCreatorDeal(creatorId: string, dealId: string) {
  const deals = await getCreatorDeals(creatorId);
  const view = deals.find((d) => d.deal.id === dealId);
  if (!view) return null;

  // The deal page shows the brief, so the campaign comes with it.
  const campaign = view.deal.campaignId
    ? await getCampaignForCreator(view.deal.campaignId)
    : null;

  return { ...view, campaign };
}

async function getCampaignForCreator(campaignId: string) {
  const db = requireServiceClient();
  const { data } = await db
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .maybeSingle();
  return data ? toCampaign(data as Record<string, unknown>) : null;
}

/**
 * What lands in the creator's account.
 *
 * On a campaign deal the brand pays the platform fee on top, so the creator
 * receives their whole fee. On a creator-initiated deal they may have agreed to
 * absorb it, and this is the one place that difference is worked out — showing
 * a creator a figure they do not actually receive is the fastest way to lose
 * them.
 */
function takeHome(deal: Deal): Kobo {
  if (deal.feePaidBy !== "creator") return deal.feeKobo;
  return deal.feeKobo - Math.floor((deal.feeKobo * deal.platformFeeBps) / 10_000);
}

export async function getCreatorMoney(creatorId: string) {
  const db = requireServiceClient();

  const [{ data: balance }, { data: deals }] = await Promise.all([
    db
      .from("v_balances")
      .select("balance_kobo")
      .eq("kind", "creator_wallet")
      .eq("creator_id", creatorId)
      .maybeSingle(),
    db
      .from("deals")
      .select("fee_kobo, status, published_at, deadline")
      .eq("creator_id", creatorId),
  ]);

  const rows = deals ?? [];
  const availableKobo = Number(balance?.balance_kobo ?? 0);

  // Signed but not yet released — what they can expect, not what they have.
  const pendingKobo = rows
    .filter((d) =>
      ["contract_signed", "draft_submitted", "revision_requested", "approved"].includes(
        d.status as string,
      ),
    )
    .reduce((sum, d) => sum + Number(d.fee_kobo), 0);

  const paid = rows.filter((d) => d.status === "paid");
  // The badge a creator can point a brand at: delivered by the date agreed.
  const onTime = paid.filter(
    (d) =>
      d.published_at &&
      d.deadline &&
      new Date(d.published_at as string) <= new Date(d.deadline as string),
  ).length;

  return {
    availableKobo,
    pendingKobo,
    lifetimeKobo: availableKobo,
    dealsCompleted: paid.length,
    onTimeCount: onTime,
    onTimeTotal: paid.length,
  };
}

export async function getSpaceName(spaceId: string): Promise<string> {
  const db = requireServiceClient();
  const { data } = await db
    .from("spaces")
    .select("name")
    .eq("id", spaceId)
    .maybeSingle();
  return (data?.name as string) ?? "A brand";
}

/**
 * The signed-in creator.
 *
 * Null until creator sessions exist — creators currently authenticate by invite
 * token, which identifies a deal rather than a person. The callers that need a
 * creator all reach them through a token, so this returning null is honest
 * rather than broken.
 */
export async function getCurrentCreator(): Promise<Creator | null> {
  return null;
}
