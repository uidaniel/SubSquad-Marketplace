import type { Bps, Kobo } from "@/lib/money";

/**
 * The shapes the product is written against.
 *
 * These mirror the Postgres schema one-for-one. Screens and server actions
 * depend on these types rather than on generated database rows, so a column
 * rename is a change in the mapping layer and not a change in fifty components.
 */

export type OrgType = "agency" | "brand";
export type VerificationStatus = "pending" | "verified" | "rejected";
export type OrgRole = "owner" | "admin" | "member";

export interface Org {
  id: string;
  type: OrgType;
  name: string;
  cacNumber: string | null;
  country: string;
  verificationStatus: VerificationStatus;
  verifiedAt: string | null;
  /** Agencies add their own margin on top of creator fees; brands do not. */
  defaultMarginBps: Bps | null;
}

export interface OrgMember {
  id: string;
  orgId: string;
  userId: string;
  name: string;
  email: string;
  role: OrgRole;
}

export interface Space {
  id: string;
  orgId: string;
  name: string;
  category: string | null;
  logoUrl: string | null;
  /** True for the single space a brand org works out of. */
  isSelf: boolean;
}

/* ==========================================================================
   Campaigns
   ========================================================================== */

export const CAMPAIGN_STATUSES = [
  "draft",
  "funded",
  "shortlisting",
  "outreach",
  "content",
  "live",
  "completed",
  "cancelled",
] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export type DeliverableType =
  | "tiktok_video"
  | "ig_reel"
  | "ig_story"
  | "yt_short"
  | "x_post";

export type ArconCategory =
  | "general"
  | "financial"
  | "alcohol"
  | "betting"
  | "health";

export interface Brief {
  objective: "awareness" | "consideration" | "conversion";
  product: string;
  keyMessages: string[];
  mustInclude: string[];
  mustAvoid: string[];
  audience: {
    ageRange: [number, number];
    gender: "any" | "female" | "male";
    cities: string[];
    languages: string[];
  };
  platforms: string[];
  tone: string;
  disclosureTag: string;
  arconCategory: ArconCategory;
  usageRightsDays: number;
}

export interface CampaignSlot {
  id: string;
  campaignId: string;
  deliverableType: DeliverableType;
  count: number;
  feeKobo: Kobo;
}

export interface Campaign {
  id: string;
  spaceId: string;
  orgId: string;
  name: string;
  /** The brand the content is for — an agency's client, or the brand itself. */
  endBrandName: string;
  status: CampaignStatus;
  budgetKobo: Kobo;
  platformFeeBps: Bps;
  agencyMarginBps: Bps | null;
  arconCategory: ArconCategory;
  brief: Brief;
  rateBandMinKobo: Kobo;
  rateBandMaxKobo: Kobo;
  deadline: string;
  createdAt: string;
}

/* ==========================================================================
   Creators
   ========================================================================== */

export type CreatorStatus = "indexed" | "invited" | "onboarded" | "suspended";
export type ContactSource = "bio" | "linkinbio" | "manual" | "referral";

export interface Creator {
  id: string;
  displayName: string;
  primaryPlatform: string;
  handle: string;
  phone: string | null;
  email: string | null;
  whatsappOptIn: boolean;
  status: CreatorStatus;
  payoutBankCode: string | null;
  payoutAccountNumber: string | null;
  payoutAccountName: string | null;
  payoutVerified: boolean;
  userId: string | null;
  contactSource: ContactSource;
  doNotContact: boolean;
  lastContactedAt: string | null;
}

export interface CreatorProfile {
  id: string;
  creatorId: string;
  platform: string;
  followers: number;
  following: number;
  postsCount: number;
  avgViews: number;
  avgLikes: number;
  avgComments: number;
  engagementRate: number;
  categoryTags: string[];
  languages: string[];
  locationCity: string | null;
  samplePosts: SamplePost[];
  fetchedAt: string;
}

export interface SamplePost {
  url: string;
  caption: string;
  views: number;
  likes: number;
  comments: number;
  transcript?: string;
  frameDescriptions?: string[];
}

export interface CreatorScoreRecord {
  id: string;
  creatorId: string;
  campaignId: string | null;
  fraudScore: number;
  reasons: { id: string; label: string; delta: number; evidence: string }[];
  computedAt: string;
}

/* ==========================================================================
   Deals
   ========================================================================== */

export const DEAL_STATUSES = [
  "invited",
  "negotiating",
  "accepted",
  "declined",
  "awaiting_funding",
  "partially_funded",
  "contract_signed",
  "draft_submitted",
  "revision_requested",
  "approved",
  "published",
  "paid",
  "cancelled",
  "disputed",
] as const;
export type DealStatus = (typeof DEAL_STATUSES)[number];

export type DealOrigin = "campaign" | "creator_direct";

export interface Deal {
  id: string;
  campaignId: string | null;
  creatorId: string;
  slotId: string | null;
  origin: DealOrigin;
  feeKobo: Kobo;
  platformFeeBps: Bps;
  feePaidBy: "brand" | "creator";
  status: DealStatus;
  deadline: string;
  inviteToken: string;
  brandApprovalToken: string | null;
  contractPdfUrl: string | null;
  contractAcceptedAt: string | null;
  publishedUrl: string | null;
  publishedAt: string | null;
  autoConfirmAt: string | null;
  createdAt: string;
}

export interface ShortlistItem {
  id: string;
  campaignId: string;
  creatorId: string;
  slotId: string | null;
  aiReasoning: string;
  fitScore: number;
  estimatedFeeKobo: Kobo;
  status: "proposed" | "approved" | "removed";
}

export interface DealMessage {
  id: string;
  dealId: string;
  direction: "outbound" | "inbound";
  channel: "whatsapp" | "email" | "manual";
  body: string;
  /** True while this is a proposal waiting for a person to approve it. */
  aiDraft: boolean;
  approvedBy: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface ContentCheck {
  id: string;
  label: string;
  status: "pass" | "fail" | "unclear";
  evidence?: string;
}

export interface AiReview {
  passes: boolean;
  checks: ContentCheck[];
  riskFlags: string[];
  creatorFeedback: string;
}

export interface Draft {
  id: string;
  dealId: string;
  version: number;
  fileUrl: string;
  caption: string;
  submittedAt: string;
  aiReview: AiReview | null;
  reviewerDecision: "approved" | "revision" | null;
  reviewerNotes: string | null;
}

/* ==========================================================================
   Money
   ========================================================================== */

export interface LedgerAccountRecord {
  id: string;
  orgId: string | null;
  spaceId: string | null;
  creatorId: string | null;
  campaignId: string | null;
  dealId: string | null;
  kind: string;
  currency: "NGN";
}

export interface LedgerTransactionRecord {
  id: string;
  type: string;
  reference: string | null;
  memo: string;
  createdBy: string | null;
  createdAt: string;
  entries: { accountId: string; amountKobo: Kobo }[];
}

/* ==========================================================================
   Read models — what screens actually need, assembled once server-side
   ========================================================================== */

/** A campaign row on the board, with the counts the board shows. */
export interface CampaignSummary {
  campaign: Campaign;
  spaceName: string;
  creatorsConfirmed: number;
  creatorsTarget: number;
  escrowHeldKobo: Kobo;
  paidOutKobo: Kobo;
  /** The one thing this campaign needs from a person, if anything. */
  nextAction: NextAction | null;
}

export interface NextAction {
  label: string;
  detail: string;
  href: string;
  tone: "warn" | "info" | "danger" | "neutral";
  /** Sorts the "needs your action" list — money first, then blocked work. */
  urgency: number;
}

export interface DealSummary {
  deal: Deal;
  creator: Creator;
  profile: CreatorProfile | null;
  score: CreatorScoreRecord | null;
  campaignName: string | null;
  endBrandName: string | null;
}
