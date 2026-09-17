import "server-only";

import { requireServiceClient } from "@/lib/supabase/service";

import { assertBalanced, LedgerError, type DraftTransaction } from "./transactions";
import type { Kobo } from "@/lib/money";

/**
 * Writing to the ledger.
 *
 * The builders in `transactions.ts` decide what a movement of money looks like;
 * this decides whether it may happen and then records it. Three safeguards, in
 * order:
 *
 *  1. The draft is re-validated here. It was validated when built, but the cost
 *     of checking again before touching money is nothing.
 *  2. Overdrafts are refused. The ledger permits a negative balance — clearing
 *     accounts are meant to go negative — so "can this account afford it" is a
 *     product rule that has to be stated per call, not inferred.
 *  3. The reference makes it idempotent. A Paystack webhook that arrives twice
 *     posts once, because the second insert collides on (type, reference) and
 *     is reported as already-applied rather than as an error.
 */

export interface PostResult {
  transactionId: string;
  /** True when this exact reference had already been posted. */
  alreadyApplied: boolean;
}

export class InsufficientFunds extends LedgerError {
  constructor(
    readonly accountId: string,
    readonly availableKobo: Kobo,
    readonly requiredKobo: Kobo,
  ) {
    super(
      `account ${accountId} holds ${availableKobo} kobo but ${requiredKobo} is needed`,
    );
    this.name = "InsufficientFunds";
  }
}

export async function balanceOf(accountId: string): Promise<Kobo> {
  const db = requireServiceClient();
  const { data, error } = await db
    .from("v_balances")
    .select("balance_kobo")
    .eq("account_id", accountId)
    .maybeSingle();
  if (error) throw new LedgerError(`could not read balance: ${error.message}`);
  return Number(data?.balance_kobo ?? 0);
}

/**
 * Posts a transaction.
 *
 * `requireFunds` names the accounts that must be able to cover what is being
 * taken out of them. Pass it for anything spending an org's or a creator's
 * money; omit it for clearing accounts, which represent money in transit and
 * are expected to sit negative between a charge and its settlement.
 */
export async function post(
  tx: DraftTransaction,
  options: { createdBy?: string | null; requireFunds?: string[] } = {},
): Promise<PostResult> {
  assertBalanced(tx);
  const db = requireServiceClient();

  if (options.requireFunds?.length) {
    for (const accountId of options.requireFunds) {
      const debit = tx.entries
        .filter((e) => e.accountId === accountId && e.amountKobo < 0)
        .reduce((sum, e) => sum + e.amountKobo, 0);
      if (debit === 0) continue;
      const available = await balanceOf(accountId);
      if (available + debit < 0) {
        throw new InsufficientFunds(accountId, available, -debit);
      }
    }
  }

  // An existing reference means this already happened. Webhooks retry; this is
  // what stops a retry from paying a creator twice.
  if (tx.reference) {
    const { data: existing } = await db
      .from("ledger_transactions")
      .select("id")
      .eq("type", tx.type)
      .eq("reference", tx.reference)
      .maybeSingle();
    if (existing) {
      return { transactionId: existing.id, alreadyApplied: true };
    }
  }

  const { data: inserted, error: txError } = await db
    .from("ledger_transactions")
    .insert({
      type: tx.type,
      reference: tx.reference ?? null,
      memo: tx.memo,
      created_by: options.createdBy ?? null,
    })
    .select("id")
    .single();
  if (txError) throw new LedgerError(`could not open transaction: ${txError.message}`);

  // All entries in one statement, so the deferred zero-sum trigger sees the
  // whole transaction. If it refuses, the header is removed rather than left
  // behind as a transaction with no movements.
  const { error: entryError } = await db.from("ledger_entries").insert(
    tx.entries.map((e) => ({
      transaction_id: inserted.id,
      account_id: e.accountId,
      amount_kobo: e.amountKobo,
    })),
  );

  if (entryError) {
    await db.from("ledger_transactions").delete().eq("id", inserted.id);
    throw new LedgerError(`the ledger refused this transaction: ${entryError.message}`);
  }

  return { transactionId: inserted.id, alreadyApplied: false };
}

/** Posts several transactions in order, stopping at the first refusal. */
export async function postAll(
  transactions: DraftTransaction[],
  options: { createdBy?: string | null; requireFunds?: string[] } = {},
): Promise<PostResult[]> {
  const results: PostResult[] = [];
  for (const tx of transactions) {
    results.push(await post(tx, options));
  }
  return results;
}

/* ==========================================================================
   Finding accounts
   ========================================================================== */

type AccountKind =
  | "space_wallet"
  | "campaign_escrow"
  | "creator_wallet"
  | "platform_fees"
  | "dispute_reserve"
  | "paystack_clearing"
  | "payout_clearing";

/**
 * Finds an account, creating it if this is the first money to touch it.
 *
 * A creator has no wallet until they are paid something; a campaign has no
 * escrow until it is funded. Creating on demand keeps the ledger free of empty
 * accounts while guaranteeing one exists the moment it is needed.
 */
export async function accountFor(
  kind: AccountKind,
  scope: {
    orgId?: string | null;
    spaceId?: string | null;
    campaignId?: string | null;
    creatorId?: string | null;
    dealId?: string | null;
  } = {},
): Promise<string> {
  const db = requireServiceClient();
  let query = db.from("ledger_accounts").select("id").eq("kind", kind);

  for (const [column, value] of [
    ["space_id", scope.spaceId],
    ["campaign_id", scope.campaignId],
    ["creator_id", scope.creatorId],
    ["deal_id", scope.dealId],
  ] as const) {
    query = value ? query.eq(column, value) : query.is(column, null);
  }

  const { data: found } = await query.maybeSingle();
  if (found) return found.id;

  // An account with no org_id is invisible to its own org: `ledger_accounts_read`
  // requires `org_id is not null and is_org_member(org_id)`, and the policies on
  // entries and transactions hang off the same check. The Paystack webhook knows
  // the space a deposit is for but has no reason to know the org behind it, so
  // asking every caller to pass one is a rule that will be broken again — a real
  // deposit posted correctly and the wallet still showed ₦0.
  const orgId = scope.orgId ?? (await orgBehind(scope));

  const { data: created, error } = await db
    .from("ledger_accounts")
    .insert({
      kind,
      org_id: orgId,
      space_id: scope.spaceId ?? null,
      campaign_id: scope.campaignId ?? null,
      creator_id: scope.creatorId ?? null,
      deal_id: scope.dealId ?? null,
    })
    .select("id")
    .single();

  if (error) throw new LedgerError(`could not open a ${kind} account: ${error.message}`);
  return created.id;
}

/**
 * Which org an account belongs to, worked out from what it is scoped to.
 *
 * Returns null legitimately for the platform's own accounts — clearing, fees,
 * the dispute reserve — and for a deal a creator brought in themselves, which
 * has no agency behind it. Those are meant to be invisible to every org.
 */
async function orgBehind(scope: {
  spaceId?: string | null;
  campaignId?: string | null;
  dealId?: string | null;
}): Promise<string | null> {
  const db = requireServiceClient();

  if (scope.spaceId) {
    const { data } = await db
      .from("spaces")
      .select("org_id")
      .eq("id", scope.spaceId)
      .maybeSingle();
    return data?.org_id ?? null;
  }

  if (scope.campaignId) {
    const { data } = await db
      .from("campaigns")
      .select("org_id")
      .eq("id", scope.campaignId)
      .maybeSingle();
    return data?.org_id ?? null;
  }

  if (scope.dealId) {
    // Two hops rather than an embedded select: Supabase types the embedding as
    // an array of an inferred shape, and unwrapping it here buys nothing.
    const { data: deal } = await db
      .from("deals")
      .select("campaign_id")
      .eq("id", scope.dealId)
      .maybeSingle();
    if (!deal?.campaign_id) return null;

    const { data: campaign } = await db
      .from("campaigns")
      .select("org_id")
      .eq("id", deal.campaign_id)
      .maybeSingle();
    return campaign?.org_id ?? null;
  }

  return null;
}
