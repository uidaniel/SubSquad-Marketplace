import "server-only";

import { requireServiceClient } from "@/lib/supabase/service";
import { accountFor, post } from "@/lib/ledger/post";
import {
  buildPlatformFee,
  buildRelease,
  type DraftTransaction,
} from "@/lib/ledger/transactions";

/**
 * Releasing a deal.
 *
 * This is the moment the product is judged on: content went live, it was
 * verified, and the creator gets paid. It is one function because there must be
 * exactly one way it can happen — whether a person clicked approve, the brand
 * stayed silent past the auto-confirm window, or ops forced a release to settle
 * a dispute. Three routes in, one set of money rules.
 *
 * Two transactions are posted, never one:
 *  - the creator's fee out of escrow, which is their money;
 *  - the platform fee, charged on top and split with the dispute reserve.
 * Keeping them separate means a creator's payout history never has the
 * platform's cut tangled up in it.
 */
export async function releaseDeal(
  dealId: string,
  options: { memo?: string; releasedBy?: string | null } = {},
): Promise<{ releasedKobo: number; feeKobo: number }> {
  const db = requireServiceClient();

  const { data: deal, error } = await db
    .from("deals")
    .select("*, campaigns(id, org_id, space_id)")
    .eq("id", dealId)
    .single();
  if (error) throw new Error(`deal ${dealId} not found: ${error.message}`);

  if (deal.status === "paid") {
    return { releasedKobo: 0, feeKobo: 0 };
  }

  const campaign = deal.campaigns as {
    id: string;
    org_id: string;
    space_id: string;
  } | null;

  // Campaign deals draw on the campaign's escrow; a deal a creator brought in
  // has its own, because there is no campaign and no agency wallet behind it.
  const escrow = campaign
    ? await accountFor("campaign_escrow", {
        orgId: campaign.org_id,
        spaceId: campaign.space_id,
        campaignId: campaign.id,
      })
    : await accountFor("campaign_escrow", { dealId: deal.id });

  const creatorWallet = await accountFor("creator_wallet", {
    creatorId: deal.creator_id,
  });
  const platformFees = await accountFor("platform_fees");
  const disputeReserve = await accountFor("dispute_reserve");

  const feeKobo = Number(deal.fee_kobo);
  const transactions: DraftTransaction[] = [
    buildRelease({
      escrowAccountId: escrow,
      creatorWalletAccountId: creatorWallet,
      feeKobo,
      memo: options.memo ?? "Released on verified publish",
    }),
  ];

  // When the creator agreed to absorb the platform fee, it comes out of what
  // they were just paid rather than out of the brand's escrow.
  const payer = deal.fee_paid_by === "creator" ? creatorWallet : escrow;
  const platformFeeKobo = Math.floor(
    (feeKobo * Number(deal.platform_fee_bps)) / 10_000,
  );

  if (platformFeeKobo > 0) {
    transactions.push(
      buildPlatformFee({
        payerAccountId: payer,
        platformFeesAccountId: platformFees,
        disputeReserveAccountId: disputeReserve,
        creatorFeeKobo: feeKobo,
        platformFeeBps: Number(deal.platform_fee_bps),
        memo: "Platform fee",
      }),
    );
  }

  for (const tx of transactions) {
    await post(tx, {
      createdBy: options.releasedBy ?? null,
      requireFunds: [escrow],
    });
  }

  await db
    .from("deals")
    .update({ status: "paid", auto_confirm_at: null })
    .eq("id", deal.id);

  // Queue the bank transfer. The creator's money is theirs from this moment;
  // moving it to their account is a separate, retryable step.
  await db.from("payouts").insert({
    creator_id: deal.creator_id,
    deal_id: deal.id,
    amount_kobo: feeKobo,
    status: "pending",
  });

  return { releasedKobo: feeKobo, feeKobo: platformFeeKobo };
}
