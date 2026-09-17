"use server";

import { randomBytes } from "node:crypto";
import { requireServiceClient } from "@/lib/supabase/service";
import { requireSession } from "@/lib/auth/session";
import { env, integrations } from "@/lib/env";
import { initialiseCheckout } from "@/lib/payments/paystack";
import { assertPositiveKobo, formatNaira, type Kobo } from "@/lib/money";

/**
 * Starting a card deposit.
 *
 * This only opens a checkout. No money reaches a wallet here and no ledger row
 * is written — that happens when Paystack's webhook confirms the charge, which
 * is the only source we trust for "this was paid". A browser that never comes
 * back still results in a funded wallet; a browser that lies about succeeding
 * results in nothing.
 *
 * The pending `payments` row written first is what lets the webhook know what
 * the money was for without trusting metadata that came back with the request.
 */

export type CheckoutResult =
  | { ok: true; authorizationUrl: string; reference: string }
  | { error: string };

/** Nigerian card processing has a floor, and a ₦50 deposit is not worth a fee. */
const MINIMUM_DEPOSIT_KOBO = 100_000; // ₦1,000

export async function startCardDeposit(args: {
  spaceId: string;
  amountKobo: Kobo;
}): Promise<CheckoutResult> {
  const session = await requireSession();

  if (!integrations.paystack) {
    return {
      error:
        "Card payments are not switched on yet. Use a bank transfer and record it below.",
    };
  }

  try {
    assertPositiveKobo(args.amountKobo, "deposit");
  } catch {
    return { error: "Enter an amount to deposit." };
  }

  if (args.amountKobo < MINIMUM_DEPOSIT_KOBO) {
    return {
      error: `The smallest card deposit is ${formatNaira(MINIMUM_DEPOSIT_KOBO)}.`,
    };
  }

  const db = requireServiceClient();

  // Confirm the space belongs to the signed-in org. A space id arriving in a
  // form field is not evidence of anything.
  const { data: space } = await db
    .from("spaces")
    .select("id, name, org_id")
    .eq("id", args.spaceId)
    .maybeSingle();

  if (!space || space.org_id !== session.org.id) {
    return { error: "That client is not on your account." };
  }

  // Our reference, not Paystack's, so the webhook can match the charge to what
  // it was for without a lookup table.
  const reference = `dep_${randomBytes(8).toString("hex")}`;

  const { error: insertError } = await db.from("payments").insert({
    space_id: space.id,
    amount_kobo: args.amountKobo,
    paystack_reference: reference,
    status: "pending",
  });

  if (insertError) {
    return { error: "Could not start the payment. Try again." };
  }

  try {
    const checkout = await initialiseCheckout({
      email: session.email,
      amountKobo: args.amountKobo,
      reference,
      metadata: {
        space_id: space.id,
        org_id: session.org.id,
        space_name: space.name,
        initiated_by: session.userId,
      },
      callbackUrl: `${env.NEXT_PUBLIC_APP_URL}/payments/complete`,
    });

    return {
      ok: true,
      authorizationUrl: checkout.authorizationUrl,
      reference,
    };
  } catch (error) {
    // The pending row would otherwise sit there forever looking like a payment
    // somebody abandoned, when in fact it never started.
    await db.from("payments").delete().eq("paystack_reference", reference);
    return {
      error: `Paystack refused to start that payment: ${(error as Error).message}`,
    };
  }
}
