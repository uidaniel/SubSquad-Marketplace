"use server";

import { randomBytes } from "node:crypto";
import { requireServiceClient } from "@/lib/supabase/service";
import { env, integrations } from "@/lib/env";
import { initialiseCheckout } from "@/lib/payments/paystack";
import { formatNaira } from "@/lib/money";
import { one } from "@/lib/data/relations";

/**
 * A guest brand paying for a creator-initiated deal.
 *
 * The person here has no account and never will — a creator sent them a link.
 * Everything is keyed off the brand approval token in the URL, which is the
 * only thing proving they are entitled to see or pay this deal.
 *
 * As with a wallet deposit, nothing is credited here: the checkout is opened
 * and the money lands in the deal's escrow when Paystack's webhook confirms the
 * charge. That path already exists — `handleChargeSuccess` routes a payment
 * carrying a `deal_id` straight into campaign escrow.
 */

export type GuestCheckoutResult =
  | { ok: true; authorizationUrl: string }
  | { error: string };

export async function startGuestPayment(
  token: string,
  /** "half" for the split-payment option shown on a first payment. */
  portion: "full" | "half",
): Promise<GuestCheckoutResult> {
  if (!integrations.paystack) {
    return { error: "Card payments are not switched on yet. Please contact the creator." };
  }

  const db = requireServiceClient();

  const { data: deal } = await db
    .from("deals")
    .select(
      "id, fee_kobo, platform_fee_bps, fee_paid_by, status, brand_approval_token, guest_brands(contact_email, brand_name)",
    )
    .eq("brand_approval_token", token)
    .maybeSingle();

  if (!deal) return { error: "This link is no longer valid." };
  if (deal.status === "cancelled") {
    return { error: "This deal has been cancelled." };
  }

  // What the brand owes: the fee, plus the platform fee unless the creator
  // agreed to absorb it.
  const fee = Number(deal.fee_kobo);
  const platformFee =
    deal.fee_paid_by === "creator"
      ? 0
      : Math.floor((fee * Number(deal.platform_fee_bps)) / 10_000);
  const total = fee + platformFee;

  // Already-paid is read from the ledger, not from a column, so a part payment
  // followed by a refund cannot leave a stale figure behind.
  const { data: escrowAccount } = await db
    .from("ledger_accounts")
    .select("id")
    .eq("kind", "campaign_escrow")
    .eq("deal_id", deal.id)
    .maybeSingle();

  let paid = 0;
  if (escrowAccount) {
    const { data: balance } = await db
      .from("v_balances")
      .select("balance_kobo")
      .eq("account_id", escrowAccount.id)
      .maybeSingle();
    paid = Number(balance?.balance_kobo ?? 0);
  }

  const outstanding = Math.max(0, total - paid);
  if (outstanding === 0) {
    return { error: "This deal is already fully funded. Nothing more is owed." };
  }

  // Half of the total, never half of what is left — otherwise repeated "pay
  // half" presses would chase the balance down forever without clearing it.
  const amountKobo =
    portion === "half" ? Math.min(outstanding, Math.ceil(total / 2)) : outstanding;

  const guest = one(deal.guest_brands) as
    | { contact_email?: string; brand_name?: string }
    | undefined;

  if (!guest?.contact_email) {
    return {
      error: "We do not have an email for this deal, so a receipt could not be sent. Please contact the creator.",
    };
  }

  const reference = `gst_${randomBytes(8).toString("hex")}`;

  const { error: insertError } = await db.from("payments").insert({
    deal_id: deal.id,
    amount_kobo: amountKobo,
    paystack_reference: reference,
    status: "pending",
  });
  if (insertError) {
    return { error: "Could not start the payment. Try again." };
  }

  try {
    const checkout = await initialiseCheckout({
      email: guest.contact_email,
      amountKobo,
      reference,
      metadata: {
        deal_id: deal.id,
        guest_company: guest.brand_name ?? null,
        portion,
      },
      callbackUrl: `${env.NEXT_PUBLIC_APP_URL}/d/${token}?paid=1`,
    });

    return { ok: true, authorizationUrl: checkout.authorizationUrl };
  } catch (error) {
    await db.from("payments").delete().eq("paystack_reference", reference);
    return {
      error: `We could not start that payment (${(error as Error).message}). Nothing was charged — ${formatNaira(amountKobo)} is still owed.`,
    };
  }
}
