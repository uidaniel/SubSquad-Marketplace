import { NextResponse } from "next/server";
import { requireServiceClient } from "@/lib/supabase/service";
import {
  verifyTransaction,
  verifyWebhookSignature,
} from "@/lib/payments/paystack";
import { accountFor, post } from "@/lib/ledger/post";
import { buildDeposit, buildReversal, buildPayout } from "@/lib/ledger/transactions";

/**
 * Paystack's webhook.
 *
 * The one endpoint in the product that a stranger can reach and that moves
 * money, so it is deliberately paranoid:
 *
 *   1. The raw body is read before anything parses it, because the signature is
 *      over those exact bytes — re-serialised JSON will not match.
 *   2. An unsigned or wrongly-signed request is dropped without a word. Anyone
 *      can POST "you have been paid ₦4,500,000" at a public URL.
 *   3. Even a valid signature is not taken at face value: the transaction is
 *      re-read from Paystack before a wallet is credited, so a replayed body
 *      cannot inflate an amount.
 *   4. Everything is keyed on the Paystack reference, and the ledger refuses a
 *      reference it has already posted. Paystack retries for up to three days;
 *      a retry must never pay anybody twice.
 *
 * It always returns 200 once the signature verifies. A non-200 makes Paystack
 * retry, and retrying will not fix a payment that referenced a campaign we
 * cannot find — that needs a person, and it is put in front of one.
 */

export const runtime = "nodejs";

interface PaystackEvent {
  event: string;
  data: {
    reference?: string;
    amount?: number;
    status?: string;
    transfer_code?: string;
    reason?: string;
    metadata?: Record<string, unknown>;
    recipient?: { recipient_code?: string };
  };
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    // No detail in the response: an attacker probing the endpoint learns
    // nothing about why their forgery failed.
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let event: PaystackEvent;
  try {
    event = JSON.parse(rawBody) as PaystackEvent;
  } catch {
    return new NextResponse("Malformed body", { status: 400 });
  }

  const db = requireServiceClient();

  // Every verified event is recorded before it is acted on, so there is a trail
  // even for the ones that then fail to apply.
  await db.from("webhook_events").insert({
    provider: "paystack",
    event_type: event.event,
    reference: event.data.reference ?? event.data.transfer_code ?? null,
    payload: event as unknown as Record<string, unknown>,
  });

  try {
    switch (event.event) {
      case "charge.success":
        await handleChargeSuccess(event);
        break;
      case "transfer.success":
        await handleTransferSuccess(event);
        break;
      case "transfer.failed":
      case "transfer.reversed":
        await handleTransferFailed(event);
        break;
      default:
        // Paystack sends a lot that this product does not care about.
        break;
    }
  } catch (error) {
    // Logged and surfaced to ops rather than retried: the failures that reach
    // here are structural, and Paystack hammering the endpoint for three days
    // will not fix one.
    console.error(`[paystack] ${event.event} failed`, error);
    await db
      .from("webhook_events")
      .update({
        error: (error as Error).message,
        needs_attention: true,
      })
      .eq("reference", event.data.reference ?? event.data.transfer_code ?? "")
      .eq("provider", "paystack");
  }

  return NextResponse.json({ received: true });
}

/* ==========================================================================
   Money in
   ========================================================================== */

async function handleChargeSuccess(event: PaystackEvent) {
  const reference = event.data.reference;
  if (!reference) throw new Error("charge.success with no reference");

  // What Paystack's own records say, not what the request body claims.
  const verified = await verifyTransaction(reference);
  if (verified.status !== "success") {
    throw new Error(`charge ${reference} is ${verified.status}, not success`);
  }
  if (verified.currency !== "NGN") {
    throw new Error(`charge ${reference} is in ${verified.currency}, not NGN`);
  }

  const db = requireServiceClient();
  const { data: payment } = await db
    .from("payments")
    .select("*")
    .eq("paystack_reference", reference)
    .maybeSingle();

  // The metadata written at checkout says what the money was for. A payment row
  // is the stronger signal when both exist.
  const spaceId =
    payment?.space_id ?? (verified.metadata.space_id as string | undefined);
  const dealId =
    payment?.deal_id ?? (verified.metadata.deal_id as string | undefined);

  if (!spaceId && !dealId) {
    throw new Error(
      `charge ${reference} names neither a space nor a deal — a person needs to look at it`,
    );
  }

  const clearing = await accountFor("paystack_clearing");

  // A campaign deposit lands in the client's wallet; a guest brand paying for
  // one creator's deal lands straight in that deal's escrow, because there is
  // no agency wallet in that flow for it to pass through.
  const destination = dealId
    ? await accountFor("campaign_escrow", { dealId })
    : await accountFor("space_wallet", { spaceId });

  const result = await post(
    buildDeposit({
      clearingAccountId: clearing,
      destinationAccountId: destination,
      amountKobo: verified.amountKobo,
      reference,
      memo: dealId ? "Guest brand funded a deal" : "Deposit into wallet",
    }),
  );

  await db
    .from("payments")
    .upsert(
      {
        paystack_reference: reference,
        space_id: spaceId ?? null,
        deal_id: dealId ?? null,
        amount_kobo: verified.amountKobo,
        status: "success",
        raw_webhook: event as unknown as Record<string, unknown>,
      },
      { onConflict: "paystack_reference" },
    );

  if (dealId && !result.alreadyApplied) {
    await settleDealFunding(dealId);
  }
}

/**
 * Moves a creator-initiated deal along as money arrives.
 *
 * A guest brand may pay half now and half later, so this compares what escrow
 * holds against what the deal costs and sets the status accordingly, rather
 * than assuming any single payment completed it.
 */
async function settleDealFunding(dealId: string) {
  const db = requireServiceClient();
  const { data: deal } = await db
    .from("deals")
    .select("id, fee_kobo, platform_fee_bps, fee_paid_by, status, contract_accepted_at")
    .eq("id", dealId)
    .maybeSingle();
  if (!deal) return;

  const escrowId = await accountFor("campaign_escrow", { dealId });
  const { data: balance } = await db
    .from("v_balances")
    .select("balance_kobo")
    .eq("account_id", escrowId)
    .maybeSingle();

  const held = Number(balance?.balance_kobo ?? 0);
  const fee = Number(deal.fee_kobo);
  // When the creator absorbs the platform fee the brand only owes the fee itself.
  const required =
    deal.fee_paid_by === "creator"
      ? fee
      : fee + Math.floor((fee * Number(deal.platform_fee_bps)) / 10_000);

  const fullyFunded = held >= required;
  const next =
    fullyFunded && deal.contract_accepted_at
      ? "contract_signed"
      : fullyFunded
        ? "awaiting_funding"
        : "partially_funded";

  if (next !== deal.status) {
    await db.from("deals").update({ status: next }).eq("id", dealId);
  }
}

/* ==========================================================================
   Money out
   ========================================================================== */

async function handleTransferSuccess(event: PaystackEvent) {
  const code = event.data.transfer_code;
  if (!code) throw new Error("transfer.success with no transfer_code");

  const db = requireServiceClient();
  const { data: payout } = await db
    .from("payouts")
    .update({ status: "success", raw: event as unknown as Record<string, unknown> })
    .eq("paystack_transfer_code", code)
    .select("id")
    .maybeSingle();

  // Told now rather than on submission: a creator who reads "paid" and then
  // watches nothing arrive trusts the next message less.
  if (payout) {
    const { notifyCreatorPaid } = await import("@/lib/messaging/notify");
    await notifyCreatorPaid(payout.id as string);
  }
}

/**
 * A transfer that did not arrive.
 *
 * The money goes back to the creator's wallet by posting the reverse of the
 * original transaction rather than by editing or deleting it. The failed
 * attempt stays in the history, which is what lets anyone answer "where did my
 * money go" a month later.
 */
async function handleTransferFailed(event: PaystackEvent) {
  const code = event.data.transfer_code;
  if (!code) throw new Error("transfer failure with no transfer_code");

  const db = requireServiceClient();
  const { data: payout } = await db
    .from("payouts")
    .select("*")
    .eq("paystack_transfer_code", code)
    .maybeSingle();

  if (!payout) throw new Error(`no payout recorded for transfer ${code}`);
  if (payout.status === "failed") return; // Already reversed.

  const creatorWallet = await accountFor("creator_wallet", {
    creatorId: payout.creator_id,
  });
  const payoutClearing = await accountFor("payout_clearing");

  const original = buildPayout({
    creatorWalletAccountId: creatorWallet,
    payoutClearingAccountId: payoutClearing,
    amountKobo: Number(payout.amount_kobo),
    reference: `${code}:reversal`,
  });

  await post(
    buildReversal(
      original,
      `Transfer ${code} failed: ${event.data.reason ?? "no reason given"}`,
    ),
  );

  await db
    .from("payouts")
    .update({
      status: "failed",
      failure_reason: event.data.reason ?? null,
      raw: event as unknown as Record<string, unknown>,
    })
    .eq("paystack_transfer_code", code);
}
