import type {
  Campaign,
  CampaignSlot,
  Creator,
  CreatorProfile,
  CreatorScoreRecord,
  Deal,
  DealMessage,
  Draft,
  LedgerAccountRecord,
  LedgerTransactionRecord,
  Org,
  OrgMember,
  ShortlistItem,
  Space,
} from "@/lib/domain";
import { scoreCreator } from "@/lib/fraud/rules";
import {
  buildDeposit,
  buildLock,
  buildPlatformFee,
  buildRelease,
  fundingRequiredFor,
  PLATFORM_FEE_BPS_CAMPAIGN,
  type DraftTransaction,
} from "@/lib/ledger/transactions";
import { nairaToKobo } from "@/lib/money";

/**
 * The demo dataset.
 *
 * This is what the app serves when no Supabase project is configured. It exists
 * so the product can be built, reviewed and shown to a pilot agency before any
 * vendor account exists — and later, so a sales demo never touches real money.
 *
 * Two rules keep it honest:
 *  1. Dates are derived from a fixed reference point, so a screenshot taken
 *     today and one taken next month tell the same story.
 *  2. Balances are not written down. Every figure the UI shows is computed from
 *     ledger transactions built by the real builders in lib/ledger, so if the
 *     money rules are wrong the demo is visibly wrong too.
 */

/** "Today" for the demo. Everything else is expressed relative to it. */
export const DEMO_NOW = new Date("2026-09-16T09:00:00.000Z");

function daysFromNow(days: number): string {
  return new Date(DEMO_NOW.getTime() + days * 86_400_000).toISOString();
}
function hoursAgo(hours: number): string {
  return new Date(DEMO_NOW.getTime() - hours * 3_600_000).toISOString();
}

const naira = nairaToKobo;

/* ==========================================================================
   Accounts
   ========================================================================== */

export const DEMO_ORG: Org = {
  id: "org_konga",
  type: "agency",
  name: "Konga Digital",
  cacNumber: "RC 1234567",
  country: "NG",
  verificationStatus: "verified",
  verifiedAt: "2026-06-14T10:00:00.000Z",
  defaultMarginBps: 1500,
};

export const DEMO_BRAND_ORG: Org = {
  id: "org_palmpay",
  type: "brand",
  name: "PalmPay",
  cacNumber: "RC 7788991",
  country: "NG",
  verificationStatus: "verified",
  verifiedAt: "2026-07-02T10:00:00.000Z",
  defaultMarginBps: null,
};

export const DEMO_MEMBERS: OrgMember[] = [
  {
    id: "mem_ada",
    orgId: DEMO_ORG.id,
    userId: "user_ada",
    name: "Ada Nwosu",
    email: "ada@kongadigital.ng",
    role: "owner",
  },
  {
    id: "mem_tobi",
    orgId: DEMO_ORG.id,
    userId: "user_tobi",
    name: "Tobi Adeyemi",
    email: "tobi@kongadigital.ng",
    role: "admin",
  },
  {
    id: "mem_femi",
    orgId: DEMO_BRAND_ORG.id,
    userId: "user_femi",
    name: "Femi Okoro",
    email: "femi@palmpay.com",
    role: "owner",
  },
];

export const DEMO_SPACES: Space[] = [
  {
    id: "spc_palmpay",
    orgId: DEMO_ORG.id,
    name: "PalmPay",
    category: "Fintech",
    logoUrl: null,
    isSelf: false,
  },
  {
    id: "spc_sweet",
    orgId: DEMO_ORG.id,
    name: "Sweet Sensation",
    category: "Food",
    logoUrl: null,
    isSelf: false,
  },
  {
    id: "spc_cowrywise",
    orgId: DEMO_ORG.id,
    name: "Cowrywise",
    category: "Fintech",
    logoUrl: null,
    isSelf: false,
  },
  {
    id: "spc_airtel",
    orgId: DEMO_ORG.id,
    name: "Airtel Nigeria",
    category: "Telco",
    logoUrl: null,
    isSelf: false,
  },
  {
    id: "spc_sportybet",
    orgId: DEMO_ORG.id,
    name: "SportyBet",
    category: "Betting",
    logoUrl: null,
    isSelf: false,
  },
  {
    id: "spc_palmpay_self",
    orgId: DEMO_BRAND_ORG.id,
    name: "PalmPay",
    category: "Fintech",
    logoUrl: null,
    isSelf: true,
  },
];

/* ==========================================================================
   Creators
   ========================================================================== */

interface CreatorSeed {
  id: string;
  name: string;
  handle: string;
  platform: string;
  city: string;
  tags: string[];
  followers: number;
  following: number;
  engagement: number;
  avgViews: number;
  avgLikes: number;
  avgComments: number;
  status: Creator["status"];
  phone: string | null;
  email: string | null;
  comments: string[];
  bio: string;
  /** Rate the creator has accepted before, used to seed fee estimates. */
  typicalFeeNaira: number;
}

const CREATOR_SEEDS: CreatorSeed[] = [
  {
    id: "crt_chidera",
    name: "Chidera Okonkwo",
    handle: "chideraskits",
    platform: "tiktok",
    city: "Lagos",
    tags: ["skits", "comedy", "fintech"],
    followers: 128_400,
    following: 890,
    engagement: 0.074,
    avgViews: 210_000,
    avgLikes: 9_400,
    avgComments: 310,
    status: "onboarded",
    phone: "+2348030000001",
    email: "chidera@example.ng",
    bio: "Lagos skit maker. Bookings in bio.",
    comments: [
      "This is so accurate 😂 the danfo part",
      "Omo you did not have to expose us like this",
      "Where did you shoot this? The lighting is clean",
      "My sister behaves exactly like this",
    ],
    typicalFeeNaira: 82_000,
  },
  {
    id: "crt_hauwa",
    name: "Hauwa Ibrahim",
    handle: "hauwacooks",
    platform: "tiktok",
    city: "Abuja",
    tags: ["food", "recipes", "family"],
    followers: 204_000,
    following: 1_240,
    engagement: 0.092,
    avgViews: 340_000,
    avgLikes: 18_700,
    avgComments: 920,
    status: "onboarded",
    phone: "+2348030000002",
    email: "hauwa@example.ng",
    bio: "Northern kitchen, everyday food. Abuja.",
    comments: [
      "Making this tomorrow for my husband",
      "The way you cut the onions 👏 teach us",
      "Please what brand of pot is that",
      "Tried it, my children finished everything",
    ],
    typicalFeeNaira: 140_000,
  },
  {
    id: "crt_tunde",
    name: "Tunde Eze",
    handle: "tundeexplains",
    platform: "instagram",
    city: "Lagos",
    tags: ["tech", "fintech", "explainers"],
    followers: 96_200,
    following: 410,
    engagement: 0.051,
    avgViews: 88_000,
    avgLikes: 4_300,
    avgComments: 260,
    status: "onboarded",
    phone: "+2348030000003",
    email: "tunde@example.ng",
    bio: "I explain money and tech in plain English.",
    comments: [
      "Finally someone explained this properly",
      "Does this apply to savings accounts too?",
      "Sending this to my brother right now",
      "The breakdown at 0:40 was very helpful",
    ],
    typicalFeeNaira: 145_000,
  },
  {
    id: "crt_amaka",
    name: "Amaka Udeh",
    handle: "amakaeats",
    platform: "tiktok",
    city: "Enugu",
    tags: ["food", "lifestyle"],
    followers: 71_500,
    following: 620,
    engagement: 0.088,
    avgViews: 120_000,
    avgLikes: 6_100,
    avgComments: 380,
    status: "onboarded",
    phone: "+2348030000004",
    email: "amaka@example.ng",
    bio: "Enugu food and small chops.",
    comments: [
      "That abacha looks unreal",
      "Which market did you buy the ugba from?",
      "Coming to Enugu just for this",
      "You never disappoint with these recipes",
    ],
    typicalFeeNaira: 70_000,
  },
  {
    id: "crt_bolu",
    name: "Bolu Adeniyi",
    handle: "boluexplains",
    platform: "instagram",
    city: "Ibadan",
    tags: ["finance", "explainers"],
    followers: 64_300,
    following: 51_200,
    engagement: 0.032,
    avgViews: 40_000,
    avgLikes: 2_100,
    avgComments: 90,
    status: "indexed",
    phone: null,
    email: "bolu@example.ng",
    bio: "Personal finance, Ibadan.",
    comments: [
      "🔥",
      "🔥",
      "nice",
      "Good breakdown, thank you",
    ],
    typicalFeeNaira: 48_000,
  },
  {
    id: "crt_zainab",
    name: "Zainab Kabir",
    handle: "zainabglow",
    platform: "instagram",
    city: "Kano",
    tags: ["beauty", "skincare"],
    followers: 58_900,
    following: 980,
    engagement: 0.067,
    avgViews: 52_000,
    avgLikes: 3_600,
    avgComments: 210,
    status: "onboarded",
    phone: "+2348030000006",
    email: "zainab@example.ng",
    bio: "Skincare that works in harmattan.",
    comments: [
      "My skin has never been better, thank you",
      "Is this safe for oily skin?",
      "Where can I buy this in Kano?",
      "Please do a routine for teenagers",
    ],
    typicalFeeNaira: 88_000,
  },
  {
    id: "crt_ifeanyi",
    name: "Ifeanyi Mba",
    handle: "ifeanyicomedy",
    platform: "tiktok",
    city: "Port Harcourt",
    tags: ["comedy", "skits"],
    followers: 112_000,
    following: 1_800,
    engagement: 0.081,
    avgViews: 190_000,
    avgLikes: 8_900,
    avgComments: 520,
    status: "onboarded",
    phone: "+2348030000007",
    email: "ifeanyi@example.ng",
    bio: "PH boy. Skits every Tuesday.",
    comments: [
      "The landlord character is too real",
      "I watched this five times",
      "Part two please 🙏 this cannot end here",
      "My colleagues at work behave like this",
    ],
    typicalFeeNaira: 48_000,
  },
  {
    id: "crt_kemi",
    name: "Kemi Balogun",
    handle: "kemiglows_promo",
    platform: "instagram",
    city: "Lagos",
    tags: ["lifestyle"],
    followers: 210_000,
    following: 189_000,
    engagement: 0.19,
    avgViews: 30_000,
    avgLikes: 24_000,
    avgComments: 40,
    status: "indexed",
    phone: null,
    email: null,
    bio: "Daily giveaway and promo page. DM for repost.",
    comments: ["🔥", "🔥", "🔥", "nice"],
    typicalFeeNaira: 60_000,
  },
];

export const DEMO_CREATORS: Creator[] = CREATOR_SEEDS.map((s) => ({
  id: s.id,
  displayName: s.name,
  primaryPlatform: s.platform,
  handle: s.handle,
  phone: s.phone,
  email: s.email,
  whatsappOptIn: Boolean(s.phone),
  status: s.status,
  payoutBankCode: s.status === "onboarded" ? "058" : null,
  payoutAccountNumber: s.status === "onboarded" ? "0123456789" : null,
  payoutAccountName: s.status === "onboarded" ? s.name.toUpperCase() : null,
  payoutVerified: s.status === "onboarded",
  userId: s.status === "onboarded" ? `user_${s.id}` : null,
  contactSource: s.phone ? "bio" : "manual",
  doNotContact: false,
  lastContactedAt: s.status === "onboarded" ? hoursAgo(72) : null,
}));

export const DEMO_PROFILES: CreatorProfile[] = CREATOR_SEEDS.map((s) => ({
  id: `prf_${s.id}`,
  creatorId: s.id,
  platform: s.platform,
  followers: s.followers,
  following: s.following,
  postsCount: 340,
  avgViews: s.avgViews,
  avgLikes: s.avgLikes,
  avgComments: s.avgComments,
  engagementRate: s.engagement,
  categoryTags: s.tags,
  languages: s.city === "Kano" ? ["English", "Hausa"] : ["English", "Pidgin"],
  locationCity: s.city,
  samplePosts: [
    {
      url: `https://www.${s.platform}.com/@${s.handle}/1`,
      caption: `${s.tags[0]} post`,
      views: s.avgViews,
      likes: s.avgLikes,
      comments: s.avgComments,
    },
  ],
  fetchedAt: hoursAgo(20),
}));

/** Scores come from the real rules, so the demo shows the real reasons. */
export const DEMO_SCORES: CreatorScoreRecord[] = CREATOR_SEEDS.map((s) => {
  const result = scoreCreator(
    {
      handle: s.handle,
      bio: s.bio,
      followers: s.followers,
      following: s.following,
      engagementRate: s.engagement,
      avgLikes: s.avgLikes,
      avgComments: s.avgComments,
      sampleComments: s.comments,
    },
    DEMO_NOW,
  );
  return {
    id: `scr_${s.id}`,
    creatorId: s.id,
    campaignId: null,
    fraudScore: result.score,
    reasons: result.reasons,
    computedAt: result.computedAt,
  };
});

/* ==========================================================================
   Campaigns
   ========================================================================== */

export const DEMO_CAMPAIGNS: Campaign[] = [
  {
    id: "cmp_detty",
    spaceId: "spc_palmpay",
    orgId: DEMO_ORG.id,
    name: "Detty December",
    endBrandName: "PalmPay",
    status: "shortlisting",
    budgetKobo: naira(4_500_000),
    platformFeeBps: PLATFORM_FEE_BPS_CAMPAIGN,
    agencyMarginBps: 1500,
    arconCategory: "financial",
    rateBandMinKobo: naira(40_000),
    rateBandMaxKobo: naira(120_000),
    deadline: daysFromNow(76),
    createdAt: hoursAgo(50),
    brief: {
      objective: "awareness",
      product: "PalmPay instant transfers",
      keyMessages: [
        "Transfers are instant and free",
        "No card needed to send money",
      ],
      mustInclude: ["Download link in bio", "#ad in the first caption line"],
      mustAvoid: ["Competitor logos", "Guaranteed returns language"],
      audience: {
        ageRange: [18, 34],
        gender: "any",
        cities: ["Lagos", "Abuja"],
        languages: ["English", "Pidgin"],
      },
      platforms: ["tiktok", "instagram"],
      tone: "Warm, funny, not corporate",
      disclosureTag: "#ad",
      arconCategory: "financial",
      usageRightsDays: 90,
    },
  },
  {
    id: "cmp_jollof",
    spaceId: "spc_sweet",
    orgId: DEMO_ORG.id,
    name: "Jollof Week",
    endBrandName: "Sweet Sensation",
    status: "content",
    budgetKobo: naira(1_440_000),
    platformFeeBps: PLATFORM_FEE_BPS_CAMPAIGN,
    agencyMarginBps: 1500,
    arconCategory: "general",
    rateBandMinKobo: naira(60_000),
    rateBandMaxKobo: naira(150_000),
    deadline: daysFromNow(12),
    createdAt: hoursAgo(430),
    brief: {
      objective: "consideration",
      product: "Sweet Sensation jollof platter",
      keyMessages: ["The party jollof taste", "Available in 40 outlets"],
      mustInclude: ["Show the platter on camera", "#ad"],
      mustAvoid: ["Other restaurant brands"],
      audience: {
        ageRange: [18, 44],
        gender: "any",
        cities: ["Lagos", "Ibadan", "Enugu"],
        languages: ["English", "Pidgin"],
      },
      platforms: ["tiktok"],
      tone: "Hungry, everyday, loud",
      disclosureTag: "#ad",
      arconCategory: "general",
      usageRightsDays: 60,
    },
  },
  {
    id: "cmp_cowrywise",
    spaceId: "spc_cowrywise",
    orgId: DEMO_ORG.id,
    name: "Save Your December",
    endBrandName: "Cowrywise",
    status: "draft",
    budgetKobo: naira(1_200_000),
    platformFeeBps: PLATFORM_FEE_BPS_CAMPAIGN,
    agencyMarginBps: 1200,
    arconCategory: "financial",
    rateBandMinKobo: naira(50_000),
    rateBandMaxKobo: naira(110_000),
    deadline: daysFromNow(45),
    createdAt: hoursAgo(8),
    brief: {
      objective: "conversion",
      product: "Cowrywise savings plan",
      keyMessages: ["Start saving with ₦1,000", "Lock it until December"],
      mustInclude: ["Show the app", "#ad"],
      mustAvoid: ["Guaranteed returns", "Investment advice framing"],
      audience: {
        ageRange: [22, 35],
        gender: "any",
        cities: ["Lagos"],
        languages: ["English"],
      },
      platforms: ["instagram", "tiktok"],
      tone: "Calm, practical",
      disclosureTag: "#ad",
      arconCategory: "financial",
      usageRightsDays: 90,
    },
  },
];

export const DEMO_SLOTS: CampaignSlot[] = [
  {
    id: "slot_detty_tt",
    campaignId: "cmp_detty",
    deliverableType: "tiktok_video",
    count: 15,
    feeKobo: naira(85_000),
  },
  {
    id: "slot_jollof_tt",
    campaignId: "cmp_jollof",
    deliverableType: "tiktok_video",
    count: 12,
    feeKobo: naira(100_000),
  },
  {
    id: "slot_cowry_ig",
    campaignId: "cmp_cowrywise",
    deliverableType: "ig_reel",
    count: 10,
    feeKobo: naira(90_000),
  },
];

/* ==========================================================================
   Shortlist and deals
   ========================================================================== */

export const DEMO_SHORTLIST: ShortlistItem[] = [
  {
    id: "sl_1",
    campaignId: "cmp_detty",
    creatorId: "crt_chidera",
    slotId: "slot_detty_tt",
    fitScore: 94,
    estimatedFeeKobo: naira(85_000),
    status: "proposed",
    aiReasoning:
      "Lagos skit creator with three prior fintech collaborations, all disclosed correctly. Switches English and Pidgin inside one video, which matches the brief's audience. Accepted ₦82,000 for a comparable deal last month, so the estimate sits inside the rate band.",
  },
  {
    id: "sl_2",
    campaignId: "cmp_detty",
    creatorId: "crt_tunde",
    slotId: "slot_detty_tt",
    fitScore: 88,
    estimatedFeeKobo: naira(110_000),
    status: "proposed",
    aiReasoning:
      "Explains money products in plain English to a Lagos audience that skews slightly older than the brief. Strong comment quality — viewers ask follow-up questions, which suits a transfers message that needs to be understood rather than just seen.",
  },
  {
    id: "sl_3",
    campaignId: "cmp_detty",
    creatorId: "crt_ifeanyi",
    slotId: "slot_detty_tt",
    fitScore: 81,
    estimatedFeeKobo: naira(52_000),
    status: "proposed",
    aiReasoning:
      "Port Harcourt comedy reach at roughly half the Lagos rate. Not in the brief's named cities, but the audience overlaps and the cost per thousand reached is the best on this shortlist.",
  },
  {
    id: "sl_5",
    campaignId: "cmp_detty",
    creatorId: "crt_bolu",
    slotId: "slot_detty_tt",
    fitScore: 71,
    estimatedFeeKobo: naira(48_000),
    status: "proposed",
    aiReasoning:
      "Ibadan finance explainer at the lowest fee on the shortlist, and the only one already making content about money products. Included despite the score: the deductions are about audience quality, not honesty, and at this fee the downside is small.",
  },
  {
    id: "sl_4",
    campaignId: "cmp_detty",
    creatorId: "crt_zainab",
    slotId: "slot_detty_tt",
    fitScore: 64,
    estimatedFeeKobo: naira(88_000),
    status: "proposed",
    aiReasoning:
      "Kano beauty audience with high trust and Hausa-language content, which no other shortlisted creator offers. Category fit is weaker: her audience does not usually see fintech content.",
  },
];

export const DEMO_DEALS: Deal[] = [
  {
    id: "deal_jollof_chidera",
    campaignId: "cmp_jollof",
    creatorId: "crt_chidera",
    slotId: "slot_jollof_tt",
    origin: "campaign",
    feeKobo: naira(100_000),
    platformFeeBps: PLATFORM_FEE_BPS_CAMPAIGN,
    feePaidBy: "brand",
    status: "draft_submitted",
    deadline: daysFromNow(6),
    inviteToken: "inv_jollof_chidera",
    brandApprovalToken: null,
    contractPdfUrl: "/demo/contract.pdf",
    contractAcceptedAt: hoursAgo(180),
    publishedUrl: null,
    publishedAt: null,
    autoConfirmAt: null,
    createdAt: hoursAgo(300),
  },
  {
    id: "deal_jollof_hauwa",
    campaignId: "cmp_jollof",
    creatorId: "crt_hauwa",
    slotId: "slot_jollof_tt",
    origin: "campaign",
    feeKobo: naira(120_000),
    platformFeeBps: PLATFORM_FEE_BPS_CAMPAIGN,
    feePaidBy: "brand",
    status: "paid",
    deadline: daysFromNow(-4),
    inviteToken: "inv_jollof_hauwa",
    brandApprovalToken: null,
    contractPdfUrl: "/demo/contract.pdf",
    contractAcceptedAt: hoursAgo(290),
    publishedUrl: "https://www.tiktok.com/@hauwacooks/video/7412",
    publishedAt: hoursAgo(120),
    autoConfirmAt: null,
    createdAt: hoursAgo(320),
  },
  {
    id: "deal_jollof_amaka",
    campaignId: "cmp_jollof",
    creatorId: "crt_amaka",
    slotId: "slot_jollof_tt",
    origin: "campaign",
    feeKobo: naira(70_000),
    platformFeeBps: PLATFORM_FEE_BPS_CAMPAIGN,
    feePaidBy: "brand",
    status: "published",
    deadline: daysFromNow(-1),
    inviteToken: "inv_jollof_amaka",
    brandApprovalToken: null,
    contractPdfUrl: "/demo/contract.pdf",
    contractAcceptedAt: hoursAgo(260),
    publishedUrl: "https://www.tiktok.com/@amakaeats/video/9981",
    publishedAt: hoursAgo(20),
    autoConfirmAt: null,
    createdAt: hoursAgo(300),
  },
  {
    id: "deal_jollof_ifeanyi",
    campaignId: "cmp_jollof",
    creatorId: "crt_ifeanyi",
    slotId: "slot_jollof_tt",
    origin: "campaign",
    feeKobo: naira(52_000),
    platformFeeBps: PLATFORM_FEE_BPS_CAMPAIGN,
    feePaidBy: "brand",
    status: "revision_requested",
    deadline: daysFromNow(3),
    inviteToken: "inv_jollof_ifeanyi",
    brandApprovalToken: null,
    contractPdfUrl: "/demo/contract.pdf",
    contractAcceptedAt: hoursAgo(200),
    publishedUrl: null,
    publishedAt: null,
    autoConfirmAt: null,
    createdAt: hoursAgo(290),
  },
  {
    id: "deal_jollof_zainab",
    campaignId: "cmp_jollof",
    creatorId: "crt_zainab",
    slotId: "slot_jollof_tt",
    origin: "campaign",
    feeKobo: naira(88_000),
    platformFeeBps: PLATFORM_FEE_BPS_CAMPAIGN,
    feePaidBy: "brand",
    status: "contract_signed",
    deadline: daysFromNow(9),
    inviteToken: "inv_jollof_zainab",
    brandApprovalToken: null,
    contractPdfUrl: "/demo/contract.pdf",
    contractAcceptedAt: hoursAgo(40),
    publishedUrl: null,
    publishedAt: null,
    autoConfirmAt: null,
    createdAt: hoursAgo(100),
  },
  {
    id: "deal_jollof_tunde",
    campaignId: "cmp_jollof",
    creatorId: "crt_tunde",
    slotId: "slot_jollof_tt",
    origin: "campaign",
    feeKobo: naira(110_000),
    platformFeeBps: PLATFORM_FEE_BPS_CAMPAIGN,
    feePaidBy: "brand",
    status: "negotiating",
    deadline: daysFromNow(10),
    inviteToken: "inv_jollof_tunde",
    brandApprovalToken: null,
    contractPdfUrl: null,
    contractAcceptedAt: null,
    publishedUrl: null,
    publishedAt: null,
    autoConfirmAt: null,
    createdAt: hoursAgo(30),
  },
];

export const DEMO_MESSAGES: DealMessage[] = [
  {
    id: "msg_1",
    dealId: "deal_jollof_tunde",
    direction: "outbound",
    channel: "whatsapp",
    body:
      "Hi Tunde — Sweet Sensation would like one TikTok video for Jollof Week. " +
      "Fee: ₦110,000, already held in escrow. Due 26 September. " +
      "Details and accept: subsquad.ng/i/inv_jollof_tunde\nReply STOP to opt out.",
    aiDraft: false,
    approvedBy: "Ada Nwosu",
    sentAt: hoursAgo(30),
    createdAt: hoursAgo(31),
  },
  {
    id: "msg_2",
    dealId: "deal_jollof_tunde",
    direction: "inbound",
    channel: "whatsapp",
    body: "Thanks. My rate for a single TikTok is ₦145,000. Can you do that?",
    aiDraft: false,
    approvedBy: null,
    sentAt: hoursAgo(26),
    createdAt: hoursAgo(26),
  },
  {
    id: "msg_3",
    dealId: "deal_jollof_tunde",
    direction: "outbound",
    channel: "whatsapp",
    body:
      "Understood — ₦145,000 is above what this campaign can approve. " +
      "The ceiling here is ₦150,000 across the band but this slot is set at ₦110,000; " +
      "I can go to ₦125,000 and confirm today. The money is already in escrow either way.",
    aiDraft: true,
    approvedBy: null,
    sentAt: null,
    createdAt: hoursAgo(25),
  },
  {
    id: "msg_4",
    dealId: "deal_jollof_chidera",
    direction: "outbound",
    channel: "whatsapp",
    body:
      "Your draft is in review. One small thing to fix first — details in the app.",
    aiDraft: false,
    approvedBy: "Ada Nwosu",
    sentAt: hoursAgo(10),
    createdAt: hoursAgo(10),
  },
];

export const DEMO_DRAFTS: Draft[] = [
  {
    id: "drf_chidera_1",
    dealId: "deal_jollof_chidera",
    version: 1,
    fileUrl: "/demo/draft-1.mp4",
    caption:
      "When your babe says she wants jollof and you know where the real one is 😂 #ad",
    submittedAt: hoursAgo(11),
    reviewerDecision: null,
    reviewerNotes: null,
    aiReview: {
      passes: true,
      checks: [
        {
          id: "key_message_1",
          label: "Mentions the party jollof taste",
          status: "pass",
          evidence: '"this one taste like party jollof" at 0:12',
        },
        {
          id: "must_include_platter",
          label: "Shows the platter on camera",
          status: "pass",
          evidence: "Platter visible from 0:08 to 0:19",
        },
        {
          id: "disclosure",
          label: "#ad in the first caption line",
          status: "pass",
          evidence: "Caption ends with #ad — present, though not in the first line",
        },
        {
          id: "must_avoid_1",
          label: "No competitor brands in frame",
          status: "pass",
        },
      ],
      riskFlags: [],
      creatorFeedback:
        "This one is good to go. Nothing to fix — thank you for the quick turnaround.",
    },
  },
  {
    id: "drf_ifeanyi_1",
    dealId: "deal_jollof_ifeanyi",
    version: 1,
    fileUrl: "/demo/draft-2.mp4",
    caption: "The landlord that collects rent in jollof 😭",
    submittedAt: hoursAgo(30),
    reviewerDecision: "revision",
    reviewerNotes: null,
    aiReview: {
      passes: false,
      checks: [
        {
          id: "disclosure",
          label: "#ad in the first caption line",
          status: "fail",
          evidence: "No disclosure tag found anywhere in the caption",
        },
        {
          id: "key_message_1",
          label: "Mentions the party jollof taste",
          status: "unclear",
          evidence: 'Says "this food sweet" without naming the party jollof taste',
        },
        {
          id: "must_include_platter",
          label: "Shows the platter on camera",
          status: "pass",
          evidence: "Platter visible at 0:22",
        },
      ],
      riskFlags: [],
      creatorFeedback:
        "Almost there — two quick fixes:\n\n" +
        "1. Add #ad to the very first line of your caption. ARCON requires it and we cannot publish without it.\n" +
        "2. Somewhere in the video, say the jollof tastes like party jollof — that exact idea is what the brand is paying for.\n\n" +
        "Everything else passed. Resubmit when ready and it goes straight back into review.",
    },
  },
];

/* ==========================================================================
   Money — built with the real ledger, not written down
   ========================================================================== */

export const DEMO_ACCOUNTS: LedgerAccountRecord[] = [
  {
    id: "acc_clearing",
    orgId: null,
    spaceId: null,
    creatorId: null,
    campaignId: null,
    dealId: null,
    kind: "paystack_clearing",
    currency: "NGN",
  },
  {
    id: "acc_platform_fees",
    orgId: null,
    spaceId: null,
    creatorId: null,
    campaignId: null,
    dealId: null,
    kind: "platform_fees",
    currency: "NGN",
  },
  {
    id: "acc_reserve",
    orgId: null,
    spaceId: null,
    creatorId: null,
    campaignId: null,
    dealId: null,
    kind: "dispute_reserve",
    currency: "NGN",
  },
  {
    id: "acc_payout_clearing",
    orgId: null,
    spaceId: null,
    creatorId: null,
    campaignId: null,
    dealId: null,
    kind: "payout_clearing",
    currency: "NGN",
  },
  ...DEMO_SPACES.filter((s) => s.orgId === DEMO_ORG.id).map((s) => ({
    id: `acc_wallet_${s.id}`,
    orgId: s.orgId,
    spaceId: s.id,
    creatorId: null,
    campaignId: null,
    dealId: null,
    kind: "space_wallet",
    currency: "NGN" as const,
  })),
  ...DEMO_CAMPAIGNS.map((c) => ({
    id: `acc_escrow_${c.id}`,
    orgId: c.orgId,
    spaceId: c.spaceId,
    creatorId: null,
    campaignId: c.id,
    dealId: null,
    kind: "campaign_escrow",
    currency: "NGN" as const,
  })),
  ...DEMO_CREATORS.map((c) => ({
    id: `acc_creator_${c.id}`,
    orgId: null,
    spaceId: null,
    creatorId: c.id,
    campaignId: null,
    dealId: null,
    kind: "creator_wallet",
    currency: "NGN" as const,
  })),
];

export const walletAccountFor = (spaceId: string) => `acc_wallet_${spaceId}`;
export const escrowAccountFor = (campaignId: string) => `acc_escrow_${campaignId}`;
export const creatorAccountFor = (creatorId: string) => `acc_creator_${creatorId}`;

/**
 * The demo's money history.
 *
 * Every entry here came out of a builder in lib/ledger — nothing is typed in by
 * hand — so the balances the dashboard renders are the same arithmetic the
 * production ledger performs.
 */
function buildDemoTransactions(): LedgerTransactionRecord[] {
  const out: LedgerTransactionRecord[] = [];
  let seq = 0;

  const post = (tx: DraftTransaction, at: string, by: string | null = "Ada Nwosu") => {
    seq += 1;
    out.push({
      id: `ltx_${String(seq).padStart(3, "0")}`,
      type: tx.type,
      reference: tx.reference ?? null,
      memo: tx.memo,
      createdBy: by,
      createdAt: at,
      entries: tx.entries.map((e) => ({
        accountId: e.accountId,
        amountKobo: e.amountKobo,
      })),
    });
  };

  // PalmPay funded their December budget.
  post(
    buildDeposit({
      clearingAccountId: "acc_clearing",
      destinationAccountId: walletAccountFor("spc_palmpay"),
      amountKobo: naira(5_000_000),
      reference: "ps_demo_palmpay_1",
      memo: "Bank transfer from PalmPay",
    }),
    hoursAgo(60),
  );
  post(
    buildLock({
      spaceWalletAccountId: walletAccountFor("spc_palmpay"),
      escrowAccountId: escrowAccountFor("cmp_detty"),
      amountKobo: naira(4_500_000),
      memo: "Funded Detty December",
    }),
    hoursAgo(50),
  );

  // Sweet Sensation funded Jollof Week and it has been running for two weeks.
  post(
    buildDeposit({
      clearingAccountId: "acc_clearing",
      destinationAccountId: walletAccountFor("spc_sweet"),
      amountKobo: naira(2_000_000),
      reference: "ps_demo_sweet_1",
      memo: "Bank transfer from Sweet Sensation",
    }),
    hoursAgo(440),
  );
  post(
    buildLock({
      spaceWalletAccountId: walletAccountFor("spc_sweet"),
      escrowAccountId: escrowAccountFor("cmp_jollof"),
      amountKobo: naira(1_440_000),
      memo: "Funded Jollof Week",
    }),
    hoursAgo(430),
  );

  // Two Jollof Week deals reached published and were released.
  for (const deal of DEMO_DEALS) {
    if (deal.status !== "paid" && deal.status !== "published") continue;
    const at = deal.publishedAt ?? hoursAgo(100);
    post(
      buildRelease({
        escrowAccountId: escrowAccountFor(deal.campaignId!),
        creatorWalletAccountId: creatorAccountFor(deal.creatorId),
        feeKobo: deal.feeKobo,
        memo: `Released on verified publish — ${deal.id}`,
      }),
      at,
      null,
    );
    post(
      buildPlatformFee({
        payerAccountId: escrowAccountFor(deal.campaignId!),
        platformFeesAccountId: "acc_platform_fees",
        disputeReserveAccountId: "acc_reserve",
        creatorFeeKobo: deal.feeKobo,
        platformFeeBps: deal.platformFeeBps,
        memo: `Platform fee — ${deal.id}`,
      }),
      at,
      null,
    );
  }

  return out;
}

export const DEMO_TRANSACTIONS: LedgerTransactionRecord[] = buildDemoTransactions();

/** The same sum Postgres computes in `v_balances`. */
export function demoBalances(): Map<string, number> {
  const balances = new Map<string, number>();
  for (const tx of DEMO_TRANSACTIONS) {
    for (const entry of tx.entries) {
      balances.set(
        entry.accountId,
        (balances.get(entry.accountId) ?? 0) + entry.amountKobo,
      );
    }
  }
  return balances;
}

/** What a campaign of this shape needs in escrow, fees included. */
export const demoFundingRequired = (creatorFeesKobo: number) =>
  fundingRequiredFor(creatorFeesKobo, PLATFORM_FEE_BPS_CAMPAIGN);
