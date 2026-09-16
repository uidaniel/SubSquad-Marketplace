import { applyBps, assertPositiveKobo, type Bps, type Kobo, splitOff } from "@/lib/money";

/**
 * The ledger, as pure functions.
 *
 * Every movement of money in SubSquad is a transaction made of entries that sum
 * to zero. Nothing in the product stores a balance: a balance is the sum of the
 * entries against an account, which means a balance can never silently disagree
 * with its history.
 *
 * Sign convention (matching the database):
 *   positive = credit = money arriving in that account
 *   negative = debit  = money leaving it
 *
 * Nothing here touches the database. Each builder returns a draft that the store
 * layer validates once more and persists atomically, so the rules below are
 * testable on their own — which is where the money bugs would otherwise hide.
 */

export const LEDGER_ACCOUNT_KINDS = [
  "space_wallet",
  "campaign_escrow",
  "creator_wallet",
  "platform_fees",
  "dispute_reserve",
  "paystack_clearing",
  "payout_clearing",
] as const;
export type LedgerAccountKind = (typeof LEDGER_ACCOUNT_KINDS)[number];

export const LEDGER_TRANSACTION_TYPES = [
  "deposit",
  "lock",
  "release",
  "payout",
  "refund",
  "fee",
  "reserve",
] as const;
export type LedgerTransactionType = (typeof LEDGER_TRANSACTION_TYPES)[number];

export interface DraftEntry {
  accountId: string;
  amountKobo: Kobo;
}

export interface DraftTransaction {
  type: LedgerTransactionType;
  memo: string;
  /** External id — a Paystack reference, a transfer code. Used for idempotency. */
  reference?: string | null;
  entries: DraftEntry[];
}

export class LedgerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LedgerError";
  }
}

/** The proportion of the platform fee held back to settle disputes. */
export const DISPUTE_RESERVE_PERCENT = 2;

export const PLATFORM_FEE_BPS_CAMPAIGN: Bps = 1200;
export const PLATFORM_FEE_BPS_CREATOR_DIRECT: Bps = 600;

/* ==========================================================================
   Validation
   ========================================================================== */

/**
 * The invariant the whole system rests on: entries sum to zero, so no
 * transaction can create or destroy money.
 *
 * The database enforces this too, with a trigger. It is checked here as well
 * because a failed insert is a much worse place to discover the bug than a
 * failed unit test.
 */
export function assertBalanced(tx: DraftTransaction): void {
  if (tx.entries.length < 2) {
    throw new LedgerError(
      `a ${tx.type} transaction needs at least two entries, got ${tx.entries.length}`,
    );
  }

  let sum = 0;
  for (const entry of tx.entries) {
    if (!Number.isInteger(entry.amountKobo)) {
      throw new LedgerError(
        `entry against ${entry.accountId} is not a whole number of kobo: ${entry.amountKobo}`,
      );
    }
    if (entry.amountKobo === 0) {
      throw new LedgerError(
        `entry against ${entry.accountId} is zero — a transaction should not record a movement that did not happen`,
      );
    }
    sum += entry.amountKobo;
  }

  if (sum !== 0) {
    throw new LedgerError(
      `a ${tx.type} transaction must sum to zero, got ${sum} kobo — money would be ${
        sum > 0 ? "created" : "destroyed"
      }`,
    );
  }
}

/** Builds and validates in one step, so no unbalanced draft ever escapes. */
function build(tx: DraftTransaction): DraftTransaction {
  assertBalanced(tx);
  return tx;
}

/* ==========================================================================
   Builders — one per money rule in the spec
   ========================================================================== */

/**
 * Paystack confirmed a collection.
 *
 * Money enters the system at the clearing account and lands in the space wallet
 * (campaign flow) or directly in a per-deal escrow (creator-initiated flow,
 * where there is no agency wallet to pass through).
 */
export function buildDeposit(args: {
  clearingAccountId: string;
  destinationAccountId: string;
  amountKobo: Kobo;
  reference: string;
  memo?: string;
}): DraftTransaction {
  assertPositiveKobo(args.amountKobo, "deposit amount");
  return build({
    type: "deposit",
    reference: args.reference,
    memo: args.memo ?? "Paystack collection",
    entries: [
      { accountId: args.clearingAccountId, amountKobo: -args.amountKobo },
      { accountId: args.destinationAccountId, amountKobo: args.amountKobo },
    ],
  });
}

/**
 * Funding a campaign: money moves out of the space wallet and is locked in the
 * campaign's escrow account, where neither side can spend it.
 *
 * The caller must check the wallet balance first; `fundingShortfall` below is
 * the check, and the store refuses to post a lock that would overdraw.
 */
export function buildLock(args: {
  spaceWalletAccountId: string;
  escrowAccountId: string;
  amountKobo: Kobo;
  memo?: string;
}): DraftTransaction {
  assertPositiveKobo(args.amountKobo, "lock amount");
  return build({
    type: "lock",
    memo: args.memo ?? "Funded campaign escrow",
    entries: [
      { accountId: args.spaceWalletAccountId, amountKobo: -args.amountKobo },
      { accountId: args.escrowAccountId, amountKobo: args.amountKobo },
    ],
  });
}

/**
 * The creator published and it was verified: their fee leaves escrow and becomes
 * theirs. This is only the creator's money — the platform fee is a separate
 * transaction so the two are never confused in the history.
 */
export function buildRelease(args: {
  escrowAccountId: string;
  creatorWalletAccountId: string;
  feeKobo: Kobo;
  memo?: string;
}): DraftTransaction {
  assertPositiveKobo(args.feeKobo, "creator fee");
  return build({
    type: "release",
    memo: args.memo ?? "Released to creator on verified publish",
    entries: [
      { accountId: args.escrowAccountId, amountKobo: -args.feeKobo },
      { accountId: args.creatorWalletAccountId, amountKobo: args.feeKobo },
    ],
  });
}

/**
 * The platform fee, charged on top of the creator fee.
 *
 * It is split 98/2 between revenue and the dispute reserve. The split is taken
 * as a floor on the reserve side so the two credits always add back to exactly
 * the amount debited — a percentage of an odd number of kobo otherwise loses one.
 *
 * `payerAccountId` is escrow in almost every case. On a creator-initiated deal
 * where the creator agreed to absorb the fee, it is the creator's wallet instead.
 */
export function buildPlatformFee(args: {
  payerAccountId: string;
  platformFeesAccountId: string;
  disputeReserveAccountId: string;
  creatorFeeKobo: Kobo;
  platformFeeBps: Bps;
  memo?: string;
}): DraftTransaction {
  assertPositiveKobo(args.creatorFeeKobo, "creator fee");
  const total = applyBps(args.creatorFeeKobo, args.platformFeeBps);
  if (total <= 0) {
    throw new LedgerError(
      `platform fee of ${args.platformFeeBps}bps on ${args.creatorFeeKobo} kobo rounds to zero — post no fee transaction rather than an empty one`,
    );
  }
  const [revenue, reserve] = splitOff(total, DISPUTE_RESERVE_PERCENT);
  const entries: DraftEntry[] = [
    { accountId: args.payerAccountId, amountKobo: -total },
    { accountId: args.platformFeesAccountId, amountKobo: revenue },
  ];
  // A tiny fee can floor the reserve share to zero; a zero entry is not a movement.
  if (reserve > 0) {
    entries.push({ accountId: args.disputeReserveAccountId, amountKobo: reserve });
  } else {
    entries[1] = { accountId: args.platformFeesAccountId, amountKobo: total };
  }
  return build({
    type: "fee",
    memo: args.memo ?? "Platform fee",
    entries,
  });
}

/**
 * Sending a creator's balance to their bank. The money sits in payout clearing
 * until Paystack confirms the transfer; a failure reverses this transaction
 * rather than editing it.
 */
export function buildPayout(args: {
  creatorWalletAccountId: string;
  payoutClearingAccountId: string;
  amountKobo: Kobo;
  reference?: string;
  memo?: string;
}): DraftTransaction {
  assertPositiveKobo(args.amountKobo, "payout amount");
  return build({
    type: "payout",
    reference: args.reference ?? null,
    memo: args.memo ?? "Payout to creator bank account",
    entries: [
      { accountId: args.creatorWalletAccountId, amountKobo: -args.amountKobo },
      { accountId: args.payoutClearingAccountId, amountKobo: args.amountKobo },
    ],
  });
}

/** The mirror image of a transaction, used when a transfer fails at the bank. */
export function buildReversal(
  original: DraftTransaction,
  memo: string,
): DraftTransaction {
  return build({
    type: original.type,
    reference: original.reference ?? null,
    memo,
    entries: original.entries.map((e) => ({
      accountId: e.accountId,
      amountKobo: -e.amountKobo,
    })),
  });
}

/**
 * A campaign ended with money still locked: whatever was not spent goes back to
 * the wallet it came from. Unused budget is never the platform's to keep.
 */
export function buildRefund(args: {
  escrowAccountId: string;
  destinationAccountId: string;
  amountKobo: Kobo;
  memo?: string;
}): DraftTransaction {
  assertPositiveKobo(args.amountKobo, "refund amount");
  return build({
    type: "refund",
    memo: args.memo ?? "Returned unused escrow",
    entries: [
      { accountId: args.escrowAccountId, amountKobo: -args.amountKobo },
      { accountId: args.destinationAccountId, amountKobo: args.amountKobo },
    ],
  });
}

/**
 * A dispute resolved in favour of one side, paid out of the reserve rather than
 * from either party — so whoever is right is paid immediately, without waiting
 * for the other side to agree.
 */
export function buildReserveDraw(args: {
  disputeReserveAccountId: string;
  destinationAccountId: string;
  amountKobo: Kobo;
  memo: string;
}): DraftTransaction {
  assertPositiveKobo(args.amountKobo, "reserve draw");
  return build({
    type: "reserve",
    memo: args.memo,
    entries: [
      { accountId: args.disputeReserveAccountId, amountKobo: -args.amountKobo },
      { accountId: args.destinationAccountId, amountKobo: args.amountKobo },
    ],
  });
}

/* ==========================================================================
   Funding arithmetic
   ========================================================================== */

/**
 * What a campaign must hold to cover its deals.
 *
 * The platform fee is charged on top of the creator fees, so a ₦1,000,000 of
 * creator fees at 12% needs ₦1,120,000 in escrow. Funding a campaign for only
 * the creator fees would leave it unable to pay its own fee at release time,
 * which is why this is enforced at funding rather than discovered at payout.
 */
export function fundingRequiredFor(creatorFeesKobo: Kobo, platformFeeBps: Bps): Kobo {
  assertPositiveKobo(creatorFeesKobo, "creator fees");
  return creatorFeesKobo + applyBps(creatorFeesKobo, platformFeeBps);
}

/** How much more is needed to fund `required` from `available`. Zero when covered. */
export function fundingShortfall(availableKobo: Kobo, requiredKobo: Kobo): Kobo {
  return Math.max(0, requiredKobo - availableKobo);
}

/** Sums entries into a balance per account id — the same maths as `v_balances`. */
export function balancesFrom(entries: DraftEntry[]): Map<string, Kobo> {
  const balances = new Map<string, Kobo>();
  for (const entry of entries) {
    balances.set(entry.accountId, (balances.get(entry.accountId) ?? 0) + entry.amountKobo);
  }
  return balances;
}
