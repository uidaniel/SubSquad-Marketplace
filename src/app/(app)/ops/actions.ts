"use server";

import { revalidatePath } from "next/cache";
import { requireServiceClient } from "@/lib/supabase/service";
import { requireStaff, requireStaffAdmin } from "@/lib/auth/staff";
import { env } from "@/lib/env";
import { accountFor, post } from "@/lib/ledger/post";
import {
  buildRefund,
  buildRelease,
  buildReserveDraw,
} from "@/lib/ledger/transactions";
import { one } from "@/lib/data/relations";

/**
 * What ops can actually do.
 *
 * Every one of these re-checks staff membership. The layout gates the pages,
 * but a server action is a public endpoint with a URL of its own — a gate on
 * the page it happens to be rendered from protects nothing.
 *
 * Anything that moves money requires an admin, and records who did it.
 */

export type OpsResult = { ok: true; message?: string } | { error: string };

function demoGuard(): OpsResult | null {
  if (env.demoMode) {
    return { error: "This is the demo. Connect a Supabase project to act." };
  }
  return null;
}

/* ==========================================================================
   Verification
   ========================================================================== */

/**
 * Approving an account.
 *
 * Verification is what stands between "anyone can sign up" and "this company
 * exists and we checked" — the CAC number is looked up by a person against the
 * register, and this records the outcome of that.
 */
export async function verifyOrg(
  orgId: string,
  decision: "verified" | "rejected",
  note?: string,
): Promise<OpsResult> {
  const blocked = demoGuard();
  if (blocked) return blocked;
  const staff = await requireStaff();

  const db = requireServiceClient();
  const { error } = await db
    .from("orgs")
    .update({
      verification_status: decision,
      verified_at: decision === "verified" ? new Date().toISOString() : null,
      verification_note: note?.trim() || null,
      verified_by: staff.userId === "demo" ? null : staff.userId,
    })
    .eq("id", orgId);

  if (error) return { error: error.message };

  revalidatePath("/ops");
  revalidatePath("/ops/verification");
  return {
    ok: true,
    message: decision === "verified" ? "Account verified." : "Account rejected.",
  };
}

/* ==========================================================================
   Disputes
   ========================================================================== */

export type DisputeOutcome =
  | "pay_creator" // the work was delivered: release from escrow
  | "refund_brand" // it was not: the money goes back
  | "split_from_reserve"; // neither side is clearly wrong: the reserve pays

/**
 * Resolving a dispute.
 *
 * Three outcomes, each a real ledger transaction rather than a status change.
 * `split_from_reserve` exists because the honest answer is sometimes "we cannot
 * tell" — and the promise made to both sides is that whoever is right is paid
 * immediately, which a reserve is what makes possible.
 */
export async function resolveDispute(args: {
  disputeId: string;
  outcome: DisputeOutcome;
  resolution: string;
}): Promise<OpsResult> {
  const blocked = demoGuard();
  if (blocked) return blocked;
  const staff = await requireStaffAdmin();

  if (!args.resolution.trim()) {
    return { error: "Write down why. Both sides will be told this." };
  }

  const db = requireServiceClient();
  const { data: dispute } = await db
    .from("disputes")
    .select("id, deal_id, status")
    .eq("id", args.disputeId)
    .maybeSingle();

  if (!dispute) return { error: "That dispute is gone." };
  if (dispute.status === "resolved") {
    return { error: "That dispute is already resolved." };
  }

  const { data: deal } = await db
    .from("deals")
    .select("id, campaign_id, creator_id, fee_kobo, campaigns(space_id)")
    .eq("id", dispute.deal_id)
    .maybeSingle();

  if (!deal) return { error: "That deal is gone." };

  const feeKobo = Number(deal.fee_kobo);
  const campaign = one(deal.campaigns);

  const escrow = deal.campaign_id
    ? await accountFor("campaign_escrow", { campaignId: deal.campaign_id })
    : await accountFor("campaign_escrow", { dealId: deal.id });

  try {
    if (args.outcome === "pay_creator") {
      const creatorWallet = await accountFor("creator_wallet", {
        creatorId: deal.creator_id,
      });
      await post(
        buildRelease({
          escrowAccountId: escrow,
          creatorWalletAccountId: creatorWallet,
          feeKobo,
          memo: `Dispute resolved for the creator: ${args.resolution.trim()}`,
        }),
        { requireFunds: [escrow], createdBy: staff.userId },
      );
    } else if (args.outcome === "refund_brand") {
      const destination = campaign?.space_id
        ? await accountFor("space_wallet", {
            spaceId: campaign.space_id as string,
          })
        : await accountFor("paystack_clearing");
      await post(
        buildRefund({
          escrowAccountId: escrow,
          destinationAccountId: destination,
          amountKobo: feeKobo,
          memo: `Dispute resolved for the brand: ${args.resolution.trim()}`,
        }),
        { requireFunds: [escrow], createdBy: staff.userId },
      );
    } else {
      const reserve = await accountFor("dispute_reserve");
      const creatorWallet = await accountFor("creator_wallet", {
        creatorId: deal.creator_id,
      });
      await post(
        buildReserveDraw({
          disputeReserveAccountId: reserve,
          destinationAccountId: creatorWallet,
          amountKobo: feeKobo,
          memo: `Paid from the reserve: ${args.resolution.trim()}`,
        }),
        { requireFunds: [reserve], createdBy: staff.userId },
      );
    }
  } catch (error) {
    return { error: (error as Error).message };
  }

  await db
    .from("disputes")
    .update({
      status: "resolved",
      resolution: args.resolution.trim(),
      resolved_by: staff.userId === "demo" ? null : staff.userId,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", args.disputeId);

  await db
    .from("deals")
    .update({
      status: args.outcome === "refund_brand" ? "cancelled" : "approved",
    })
    .eq("id", deal.id);

  revalidatePath("/ops");
  revalidatePath("/ops/disputes");
  return { ok: true, message: "Resolved, and the ledger reflects it." };
}

/* ==========================================================================
   Payouts
   ========================================================================== */

/**
 * Retrying a failed transfer.
 *
 * Refuses while the account details are still unverified — retrying against the
 * same wrong account number produces the same failure and another fee. The
 * creator has to fix their details first, which is what the refusal says.
 */
export async function retryPayout(payoutId: string): Promise<OpsResult> {
  const blocked = demoGuard();
  if (blocked) return blocked;
  await requireStaffAdmin();

  const db = requireServiceClient();
  const { data: payout } = await db
    .from("payouts")
    .select("id, status, creator_id, creators(payout_verified)")
    .eq("id", payoutId)
    .maybeSingle();

  if (!payout) return { error: "That payout is gone." };
  if (payout.status !== "failed") {
    return { error: "That payout is not in a failed state." };
  }

  const creator = one(payout.creators);
  if (!creator?.payout_verified) {
    return {
      error:
        "The creator's account still is not verified. Ask them to fix it first — retrying now fails the same way and costs another fee.",
    };
  }

  await db
    .from("payouts")
    .update({ status: "pending", failure_reason: null })
    .eq("id", payoutId);

  revalidatePath("/ops/payouts");
  return { ok: true, message: "Queued for another attempt." };
}

/** Marks a webhook problem as dealt with, once a person has handled it. */
export async function resolveWebhookProblem(
  id: string,
): Promise<OpsResult> {
  const blocked = demoGuard();
  if (blocked) return blocked;
  const staff = await requireStaff();

  const db = requireServiceClient();
  await db
    .from("webhook_events")
    .update({
      resolved_at: new Date().toISOString(),
      resolved_by: staff.userId === "demo" ? null : staff.userId,
      needs_attention: false,
    })
    .eq("id", id);

  revalidatePath("/ops/webhooks");
  return { ok: true };
}
