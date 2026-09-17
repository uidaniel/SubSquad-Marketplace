"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireServiceClient } from "@/lib/supabase/service";
import { getCurrentCreator } from "@/lib/data/creator-queries";
import { accountFor, balanceOf, post } from "@/lib/ledger/post";
import { buildPayout } from "@/lib/ledger/transactions";
import {
  createTransferRecipient,
  sendTransfer,
  PaystackError,
} from "@/lib/payments/paystack";
import { env } from "@/lib/env";
import { formatNaira } from "@/lib/money";

export type WithdrawResult = { ok: true; message: string } | { ok: false; message: string };

/** Below this the ₦10–50 transfer fee is a meaningful share of the payout. */
const MINIMUM_WITHDRAWAL_KOBO = 100_000; // ₦1,000

/**
 * A creator taking their money out.
 *
 * The screen had a Withdraw button from the start and nothing behind it, which
 * is the worst gap in the product: every other step exists to get money to this
 * person, and the last one did not work.
 *
 * The ledger moves first, then Paystack. If the transfer call fails the ledger
 * entry is reversed, so a creator is never left with a wallet that says the
 * money has gone when it has not. If the transfer succeeds but the webhook
 * never arrives, the payout sits as `pending` and shows in the ops queue — a
 * human problem, not a silently lost balance.
 */
export async function requestWithdrawal(): Promise<WithdrawResult> {
  const creator = await getCurrentCreator();
  if (!creator) {
    return { ok: false, message: "Sign in again to withdraw." };
  }

  const db = requireServiceClient();

  const { data: row } = await db
    .from("creators")
    .select(
      "id, display_name, payout_bank_code, payout_account_number, payout_account_name, payout_verified",
    )
    .eq("id", creator.id)
    .maybeSingle();

  if (!row) return { ok: false, message: "We could not find your account." };

  // Paying an unverified account is how money reaches the wrong person and
  // cannot be pulled back.
  if (!row.payout_verified || !row.payout_bank_code || !row.payout_account_number) {
    return {
      ok: false,
      message:
        "Add and verify your bank account first — we will not send money to an account we have not checked the name on.",
    };
  }

  const wallet = await accountFor("creator_wallet", { creatorId: creator.id });
  const available = await balanceOf(wallet);

  if (available <= 0) {
    return { ok: false, message: "There is nothing to withdraw yet." };
  }
  if (available < MINIMUM_WITHDRAWAL_KOBO) {
    return {
      ok: false,
      message: `The smallest withdrawal is ${formatNaira(MINIMUM_WITHDRAWAL_KOBO)}. You have ${formatNaira(available)} — it will be here when it reaches that.`,
    };
  }

  // One in flight at a time. A creator tapping twice on a slow connection must
  // not start two transfers against the same balance.
  const { data: inFlight } = await db
    .from("payouts")
    .select("id")
    .eq("creator_id", creator.id)
    .eq("status", "pending")
    .limit(1);

  if (inFlight?.length) {
    return {
      ok: false,
      message: "A withdrawal is already on its way. It usually lands within 24 hours.",
    };
  }

  const reference = `pay_${randomBytes(8).toString("hex")}`;
  const payoutClearing = await accountFor("payout_clearing");

  await post(
    buildPayout({
      creatorWalletAccountId: wallet,
      payoutClearingAccountId: payoutClearing,
      amountKobo: available,
      reference,
      memo: `Withdrawal to ${row.payout_account_name ?? "bank account"}`,
    }),
    { requireFunds: [wallet] },
  );

  const { data: payout } = await db
    .from("payouts")
    .insert({
      creator_id: creator.id,
      amount_kobo: available,
      status: "pending",
    })
    .select("id")
    .single();

  try {
    const recipient = await createTransferRecipient({
      name: row.payout_account_name ?? row.display_name,
      accountNumber: row.payout_account_number,
      bankCode: row.payout_bank_code,
    });

    const transfer = await sendTransfer({
      recipientCode: recipient.recipientCode,
      amountKobo: available,
      reference,
      reason: "SubSquad creator payout",
    });

    await db
      .from("payouts")
      .update({ paystack_transfer_code: transfer.transferCode })
      .eq("id", payout!.id);

    revalidatePath("/creator/wallet");
    revalidatePath("/creator");

    return {
      ok: true,
      message: transfer.dryRun
        ? `${formatNaira(available)} was recorded as sent. DRY_RUN is on, so no real transfer left the account.`
        : `${formatNaira(available)} is on its way to your bank. It usually lands within 24 hours.`,
    };
  } catch (error) {
    // Paystack refused. Put the money back where it was rather than leaving a
    // wallet that reads zero against a transfer that never happened.
    const { buildReversal } = await import("@/lib/ledger/transactions");
    await post(
      buildReversal(
        buildPayout({
          creatorWalletAccountId: wallet,
          payoutClearingAccountId: payoutClearing,
          amountKobo: available,
          reference: `${reference}:reversal`,
        }),
        `Withdrawal ${reference} could not be started`,
      ),
    );
    await db
      .from("payouts")
      .update({
        status: "failed",
        failure_reason: (error as Error).message,
      })
      .eq("id", payout!.id);

    revalidatePath("/creator/wallet");

    const detail =
      error instanceof PaystackError
        ? error.message
        : "something went wrong on our side";

    return {
      ok: false,
      message: `We could not start the transfer — ${detail}. Your ${formatNaira(available)} is untouched and still in your wallet.`,
    };
  }
}

/** What the button should say, and whether it can be pressed. */
export async function withdrawalState(): Promise<{
  availableKobo: number;
  canWithdraw: boolean;
  reason: string | null;
  bankLabel: string | null;
  pending: boolean;
}> {
  const creator = await getCurrentCreator();
  if (!creator) {
    return {
      availableKobo: 0,
      canWithdraw: false,
      reason: "Sign in to withdraw.",
      bankLabel: null,
      pending: false,
    };
  }

  if (env.demoMode) {
    return {
      availableKobo: 0,
      canWithdraw: false,
      reason: "Withdrawals need a connected Supabase project.",
      bankLabel: null,
      pending: false,
    };
  }

  const db = requireServiceClient();
  const { data: row } = await db
    .from("creators")
    .select("payout_account_number, payout_account_name, payout_verified")
    .eq("id", creator.id)
    .maybeSingle();

  const wallet = await accountFor("creator_wallet", { creatorId: creator.id });
  const availableKobo = await balanceOf(wallet);

  const { data: inFlight } = await db
    .from("payouts")
    .select("id")
    .eq("creator_id", creator.id)
    .eq("status", "pending")
    .limit(1);

  const pending = Boolean(inFlight?.length);
  const last4 = row?.payout_account_number?.slice(-4);

  return {
    availableKobo,
    pending,
    bankLabel: last4 ? `account ending ${last4}` : null,
    canWithdraw:
      Boolean(row?.payout_verified) &&
      availableKobo >= MINIMUM_WITHDRAWAL_KOBO &&
      !pending,
    reason: !row?.payout_verified
      ? "Add and verify your bank account to withdraw."
      : pending
        ? "A withdrawal is already on its way."
        : availableKobo <= 0
          ? "Nothing to withdraw yet."
          : availableKobo < MINIMUM_WITHDRAWAL_KOBO
            ? `The smallest withdrawal is ${formatNaira(MINIMUM_WITHDRAWAL_KOBO)}.`
            : null,
  };
}
