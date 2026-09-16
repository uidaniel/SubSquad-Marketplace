import { logger, task } from "@trigger.dev/sdk";
import { requireServiceClient } from "@/lib/supabase/service";
import { accountFor, balanceOf, post } from "@/lib/ledger/post";
import { buildPayout, buildReversal } from "@/lib/ledger/transactions";
import { env } from "@/lib/env";

/**
 * Paying a creator.
 *
 * The product's central promise is that creators are paid within seven days of
 * publishing, so this is the task that promise actually rests on. It is written
 * to be safe to retry: the ledger movement is keyed on the payout row's id, so
 * a retry after a network failure finds the transaction already posted rather
 * than sending the money a second time.
 */
export const processPayout = task({
  id: "payout.process",
  maxDuration: 120,
  run: async (payload: { payoutId: string }) => {
    const db = requireServiceClient();

    const { data: payout, error } = await db
      .from("payouts")
      .select("*, creators(display_name, payout_bank_code, payout_account_number, payout_verified)")
      .eq("id", payload.payoutId)
      .single();
    if (error) throw new Error(`payout ${payload.payoutId} not found: ${error.message}`);

    if (payout.status === "success") {
      logger.info("Already paid; nothing to do", { payoutId: payout.id });
      return { status: "already_paid" as const };
    }

    const creator = payout.creators as {
      display_name: string;
      payout_bank_code: string | null;
      payout_account_number: string | null;
      payout_verified: boolean;
    };

    // A transfer to an unverified account is how money goes to the wrong person.
    if (!creator.payout_verified || !creator.payout_account_number) {
      await db
        .from("payouts")
        .update({
          status: "failed",
          failure_reason: "Payout account is not verified",
        })
        .eq("id", payout.id);
      return { status: "blocked" as const, reason: "unverified_account" };
    }

    const creatorWallet = await accountFor("creator_wallet", {
      creatorId: payout.creator_id,
    });
    const available = await balanceOf(creatorWallet);
    const amount = Number(payout.amount_kobo);

    if (available < amount) {
      await db
        .from("payouts")
        .update({
          status: "failed",
          failure_reason: `Wallet holds ${available} kobo, payout is ${amount}`,
        })
        .eq("id", payout.id);
      return { status: "blocked" as const, reason: "insufficient_balance" };
    }

    const clearing = await accountFor("payout_clearing");
    const movement = buildPayout({
      creatorWalletAccountId: creatorWallet,
      payoutClearingAccountId: clearing,
      amountKobo: amount,
      reference: payout.id,
      memo: `Payout to ${creator.display_name}`,
    });

    const posted = await post(movement, { requireFunds: [creatorWallet] });
    logger.info("Ledger movement recorded", {
      transactionId: posted.transactionId,
      alreadyApplied: posted.alreadyApplied,
    });

    await db.from("payouts").update({ status: "processing" }).eq("id", payout.id);

    if (env.DRY_RUN) {
      logger.info("DRY_RUN: not calling Paystack", { amount });
      await db
        .from("payouts")
        .update({ status: "success", paystack_transfer_code: `dryrun_${payout.id}` })
        .eq("id", payout.id);
      return { status: "paid" as const, dryRun: true };
    }

    try {
      const transferCode = await paystackTransfer({
        amountKobo: amount,
        bankCode: creator.payout_bank_code!,
        accountNumber: creator.payout_account_number,
        accountName: creator.display_name,
        reference: payout.id,
      });
      await db
        .from("payouts")
        .update({ status: "processing", paystack_transfer_code: transferCode })
        .eq("id", payout.id);
      return { status: "submitted" as const, transferCode };
    } catch (failure) {
      // The bank refused it, so the money never left. Put it back in the wallet
      // rather than leaving it stranded in clearing.
      await post(buildReversal(movement, `Transfer failed: ${(failure as Error).message}`));
      await db
        .from("payouts")
        .update({ status: "failed", failure_reason: (failure as Error).message })
        .eq("id", payout.id);
      throw failure;
    }
  },
});

async function paystackTransfer(args: {
  amountKobo: number;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  reference: string;
}): Promise<string> {
  if (!env.PAYSTACK_SECRET_KEY) throw new Error("Paystack is not configured");

  const recipient = await fetch("https://api.paystack.co/transferrecipient", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "nuban",
      name: args.accountName,
      account_number: args.accountNumber,
      bank_code: args.bankCode,
      currency: "NGN",
    }),
  }).then((r) => r.json());

  if (!recipient.status) throw new Error(`Paystack recipient: ${recipient.message}`);

  const transfer = await fetch("https://api.paystack.co/transfer", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      source: "balance",
      amount: args.amountKobo,
      recipient: recipient.data.recipient_code,
      reason: "SubSquad creator payout",
      reference: args.reference,
    }),
  }).then((r) => r.json());

  if (!transfer.status) throw new Error(`Paystack transfer: ${transfer.message}`);
  return transfer.data.transfer_code as string;
}
