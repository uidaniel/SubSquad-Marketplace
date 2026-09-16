import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { env, integrations } from "@/lib/env";
import type { Kobo } from "@/lib/money";

/**
 * Paystack.
 *
 * Collections (money in) and transfers (money out). Everything here speaks in
 * kobo, which is also Paystack's unit, so no conversion happens at this
 * boundary and none can go wrong there.
 *
 * Two rules hold throughout:
 *
 *   · A webhook is not trusted until its signature verifies. Anyone can POST
 *     "you have been paid ₦4,500,000" at a public URL.
 *   · DRY_RUN never sends a real transfer. Collections are safe to exercise
 *     with test keys; a transfer moves money out, so it needs the switch off
 *     deliberately.
 */

const API = "https://api.paystack.co";

export class PaystackError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "PaystackError";
  }
}

function secret(): string {
  if (!env.PAYSTACK_SECRET_KEY) {
    throw new PaystackError("Paystack is not configured.");
  }
  return env.PAYSTACK_SECRET_KEY;
}

/**
 * Whether this key can move real money.
 *
 * Surfaced on the ops health screen, because "are we live?" should be a fact on
 * a page rather than a thing somebody remembers.
 */
export function isLiveKey(): boolean {
  return Boolean(env.PAYSTACK_SECRET_KEY?.startsWith("sk_live_"));
}

async function call<T>(
  path: string,
  init?: RequestInit & { body?: string },
): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secret()}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });

  const json = (await response.json()) as {
    status: boolean;
    message?: string;
    data?: T;
  };

  if (!response.ok || !json.status) {
    throw new PaystackError(
      json.message ?? `Paystack returned ${response.status}`,
      response.status,
    );
  }
  return json.data as T;
}

/* ==========================================================================
   Webhook verification
   ========================================================================== */

/**
 * Checks that a webhook really came from Paystack.
 *
 * Paystack signs the raw body with the secret key as `x-paystack-signature`.
 * The comparison is constant-time: a byte-by-byte one leaks, through timing,
 * how much of a forged signature was right, which is enough to construct a
 * valid one given enough attempts.
 *
 * The *raw* body must be passed — re-serialised JSON will not match, because
 * key order and whitespace are part of what was signed.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
): boolean {
  if (!signature || !env.PAYSTACK_SECRET_KEY) return false;

  const expected = createHmac("sha512", env.PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/* ==========================================================================
   Collections — money in
   ========================================================================== */

export interface InitialisedCheckout {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

/**
 * Starts a checkout.
 *
 * The reference is ours rather than Paystack's, so the webhook that arrives
 * later can be matched to what it was for without a lookup table — and so a
 * retry of the same intent reuses the same reference instead of creating a
 * second charge.
 */
export async function initialiseCheckout(args: {
  email: string;
  amountKobo: Kobo;
  reference: string;
  /** Read back on the webhook to know what the money was for. */
  metadata: Record<string, unknown>;
  callbackUrl?: string;
}): Promise<InitialisedCheckout> {
  if (!integrations.paystack) {
    throw new PaystackError("Paystack is not configured.");
  }

  const data = await call<{
    authorization_url: string;
    access_code: string;
    reference: string;
  }>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: args.email,
      amount: args.amountKobo,
      reference: args.reference,
      currency: "NGN",
      metadata: args.metadata,
      callback_url: args.callbackUrl,
    }),
  });

  return {
    authorizationUrl: data.authorization_url,
    accessCode: data.access_code,
    reference: data.reference,
  };
}

export interface VerifiedTransaction {
  reference: string;
  amountKobo: Kobo;
  status: string;
  paidAt: string | null;
  currency: string;
  customerEmail: string | null;
  metadata: Record<string, unknown>;
}

/**
 * Asks Paystack what actually happened.
 *
 * Called even when a webhook says a payment succeeded. The webhook says what
 * someone claims; this says what Paystack's own records hold, and only the
 * second is worth crediting a wallet on.
 */
export async function verifyTransaction(
  reference: string,
): Promise<VerifiedTransaction> {
  const data = await call<{
    reference: string;
    amount: number;
    status: string;
    paid_at: string | null;
    currency: string;
    customer?: { email?: string };
    metadata?: Record<string, unknown>;
  }>(`/transaction/verify/${encodeURIComponent(reference)}`);

  return {
    reference: data.reference,
    amountKobo: data.amount,
    status: data.status,
    paidAt: data.paid_at,
    currency: data.currency,
    customerEmail: data.customer?.email ?? null,
    metadata: data.metadata ?? {},
  };
}

/* ==========================================================================
   Transfers — money out
   ========================================================================== */

export interface TransferRecipient {
  recipientCode: string;
}

/** Registers a creator's bank account so it can be paid. Idempotent per account. */
export async function createTransferRecipient(args: {
  name: string;
  accountNumber: string;
  bankCode: string;
}): Promise<TransferRecipient> {
  const data = await call<{ recipient_code: string }>("/transferrecipient", {
    method: "POST",
    body: JSON.stringify({
      type: "nuban",
      name: args.name,
      account_number: args.accountNumber,
      bank_code: args.bankCode,
      currency: "NGN",
    }),
  });
  return { recipientCode: data.recipient_code };
}

export interface TransferResult {
  transferCode: string;
  status: string;
  reference: string;
  dryRun: boolean;
}

/**
 * Sends money to a creator.
 *
 * Refuses to run under DRY_RUN. Collections can be exercised harmlessly with
 * test keys; a transfer is the one call that takes money out of the account, so
 * it requires the switch to have been turned off on purpose.
 */
export async function sendTransfer(args: {
  recipientCode: string;
  amountKobo: Kobo;
  reference: string;
  reason: string;
}): Promise<TransferResult> {
  if (env.DRY_RUN) {
    console.info(
      `[dry-run] would transfer ${args.amountKobo} kobo to ${args.recipientCode} (${args.reason})`,
    );
    return {
      transferCode: `dryrun_${args.reference}`,
      status: "pending",
      reference: args.reference,
      dryRun: true,
    };
  }

  const data = await call<{
    transfer_code: string;
    status: string;
    reference: string;
  }>("/transfer", {
    method: "POST",
    body: JSON.stringify({
      source: "balance",
      amount: args.amountKobo,
      recipient: args.recipientCode,
      reference: args.reference,
      reason: args.reason,
      currency: "NGN",
    }),
  });

  return {
    transferCode: data.transfer_code,
    status: data.status,
    reference: data.reference,
    dryRun: false,
  };
}

/** What Paystack holds, which is the ceiling on what can be paid out today. */
export async function getBalance(): Promise<Kobo> {
  const data = await call<{ currency: string; balance: number }[]>("/balance");
  const ngn = data.find((b) => b.currency === "NGN");
  return ngn?.balance ?? 0;
}
