import "server-only";

import { env } from "@/lib/env";
import { requireServiceClient } from "@/lib/supabase/service";
import { integrations } from "@/lib/env";
import { formatNaira, type Kobo } from "@/lib/money";
import { one } from "@/lib/data/relations";

/**
 * The ops console's reads.
 *
 * These deliberately cross org boundaries — that is what an ops console is for —
 * so they run through the service client. The gate is `requireStaff()` in the
 * layout above them, checked once per request, rather than a filter threaded
 * through every query where one missed call would open everything.
 */

export interface VerificationItem {
  orgId: string;
  name: string;
  type: "agency" | "brand";
  cacNumber: string | null;
  createdAt: string;
  /** Whether they have money waiting, which is what makes this urgent. */
  walletKobo: Kobo;
  memberCount: number;
}

export async function getVerificationQueue(): Promise<VerificationItem[]> {
  if (env.demoMode) return DEMO_VERIFICATION;

  const db = requireServiceClient();
  const { data: orgs } = await db
    .from("orgs")
    .select("id, name, type, cac_number, created_at")
    .eq("verification_status", "pending")
    .order("created_at", { ascending: true });

  if (!orgs?.length) return [];

  const ids = orgs.map((o) => o.id);
  const [{ data: balances }, { data: members }] = await Promise.all([
    db.from("v_balances").select("org_id, balance_kobo").in("org_id", ids),
    db.from("org_members").select("org_id").in("org_id", ids),
  ]);

  const walletByOrg = new Map<string, number>();
  for (const row of balances ?? []) {
    if (!row.org_id) continue;
    walletByOrg.set(
      row.org_id,
      (walletByOrg.get(row.org_id) ?? 0) + Number(row.balance_kobo),
    );
  }
  const membersByOrg = new Map<string, number>();
  for (const row of members ?? []) {
    membersByOrg.set(row.org_id, (membersByOrg.get(row.org_id) ?? 0) + 1);
  }

  return orgs.map((o) => ({
    orgId: o.id,
    name: o.name,
    type: o.type as "agency" | "brand",
    cacNumber: o.cac_number,
    createdAt: o.created_at,
    walletKobo: walletByOrg.get(o.id) ?? 0,
    memberCount: membersByOrg.get(o.id) ?? 0,
  }));
}

export interface DisputeItem {
  id: string;
  dealId: string;
  openedBy: "creator" | "org";
  reason: string;
  status: string;
  createdAt: string;
  creatorName: string;
  brandName: string;
  feeKobo: Kobo;
  /** What escrow still holds for this deal — the money the decision is about. */
  escrowKobo: Kobo;
}

export async function getDisputes(): Promise<DisputeItem[]> {
  if (env.demoMode) return DEMO_DISPUTES;

  const db = requireServiceClient();
  const { data } = await db
    .from("disputes")
    .select(
      "id, deal_id, opened_by, reason, status, created_at, deals(fee_kobo, creators(display_name), campaigns(end_brand_name))",
    )
    .neq("status", "resolved")
    .order("created_at", { ascending: true });

  return (data ?? []).map((d) => {
    const deal = one(d.deals);
    const creator = one(deal?.creators);
    const campaign = one(deal?.campaigns);
    return {
      id: d.id,
      dealId: d.deal_id,
      openedBy: d.opened_by as "creator" | "org",
      reason: d.reason,
      status: d.status,
      createdAt: d.created_at,
      creatorName: (creator?.display_name as string) ?? "Unknown creator",
      brandName: (campaign?.end_brand_name as string) ?? "Own deal",
      feeKobo: Number(deal?.fee_kobo ?? 0),
      escrowKobo: 0,
    };
  });
}

export interface FailedPayoutItem {
  id: string;
  creatorId: string;
  creatorName: string;
  amountKobo: Kobo;
  reason: string | null;
  transferCode: string | null;
  createdAt: string;
  /** Whether the account details have since been corrected. */
  payoutVerified: boolean;
  bankAccount: string | null;
}

export async function getFailedPayouts(): Promise<FailedPayoutItem[]> {
  if (env.demoMode) return DEMO_FAILED_PAYOUTS;

  const db = requireServiceClient();
  const { data } = await db
    .from("payouts")
    .select(
      "id, creator_id, amount_kobo, failure_reason, paystack_transfer_code, created_at, creators(display_name, payout_verified, payout_account_number, payout_bank_code)",
    )
    .eq("status", "failed")
    .order("created_at", { ascending: false });

  return (data ?? []).map((p) => {
    const creator = one(p.creators);
    return {
      id: p.id,
      creatorId: p.creator_id,
      creatorName: (creator?.display_name as string) ?? "Unknown creator",
      amountKobo: Number(p.amount_kobo),
      reason: p.failure_reason,
      transferCode: p.paystack_transfer_code,
      createdAt: p.created_at,
      payoutVerified: Boolean(creator?.payout_verified),
      bankAccount: (creator?.payout_account_number as string) ?? null,
    };
  });
}

export interface WebhookProblem {
  id: string;
  provider: string;
  eventType: string;
  reference: string | null;
  error: string | null;
  createdAt: string;
}

export async function getWebhookProblems(): Promise<WebhookProblem[]> {
  if (env.demoMode) return [];

  const db = requireServiceClient();
  const { data } = await db
    .from("webhook_events")
    .select("id, provider, event_type, reference, error, created_at")
    .eq("needs_attention", true)
    .is("resolved_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  return (data ?? []).map((w) => ({
    id: w.id,
    provider: w.provider,
    eventType: w.event_type,
    reference: w.reference,
    error: w.error,
    createdAt: w.created_at,
  }));
}

/** The counts the console's navigation badges are built from. */
export async function getOpsCounts() {
  const [verification, disputes, payouts, webhooks] = await Promise.all([
    getVerificationQueue(),
    getDisputes(),
    getFailedPayouts(),
    getWebhookProblems(),
  ]);
  return {
    verification: verification.length,
    disputes: disputes.length,
    payouts: payouts.length,
    webhooks: webhooks.length,
    total:
      verification.length + disputes.length + payouts.length + webhooks.length,
  };
}

/** What is switched on right now, so "are we live?" is a fact on a page. */
export function getIntegrationHealth() {
  const live = Boolean(process.env.PAYSTACK_SECRET_KEY?.startsWith("sk_live_"));
  return {
    dryRun: env.DRY_RUN,
    paystackLive: live,
    integrations,
  };
}

/* ==========================================================================
   Demo fixtures
   ========================================================================== */

const DEMO_VERIFICATION: VerificationItem[] = [
  {
    orgId: "org_sportybet",
    name: "SportyBet Nigeria",
    type: "brand",
    cacNumber: "RC 1884420",
    createdAt: new Date(Date.now() - 26 * 3600_000).toISOString(),
    walletKobo: 0,
    memberCount: 2,
  },
  {
    orgId: "org_bluebridge",
    name: "Blue Bridge Media",
    type: "agency",
    cacNumber: null,
    createdAt: new Date(Date.now() - 4 * 3600_000).toISOString(),
    walletKobo: 25_000_000,
    memberCount: 1,
  },
];

const DEMO_DISPUTES: DisputeItem[] = [
  {
    id: "dsp_1",
    dealId: "deal_sporty_bolu",
    openedBy: "creator",
    reason:
      "Brand asked for a second video after I posted. Says the first one does not count.",
    status: "open",
    createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    creatorName: "Bolu A.",
    brandName: "SportyBet",
    feeKobo: 4_800_000,
    escrowKobo: 4_800_000,
  },
];

const DEMO_FAILED_PAYOUTS: FailedPayoutItem[] = [
  {
    id: "pay_failed_1",
    creatorId: "crt_ifeanyi",
    creatorName: "Ifeanyi M.",
    amountKobo: 4_800_000,
    reason: "Account name does not match the account number",
    transferCode: "TRF_demo1",
    createdAt: new Date(Date.now() - 20 * 3600_000).toISOString(),
    payoutVerified: false,
    bankAccount: "0123456789",
  },
];

/** Used in a couple of ops summaries where a figure reads better than a count. */
export function money(kobo: Kobo): string {
  return formatNaira(kobo);
}
