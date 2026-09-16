import { describe, expect, it } from "vitest";
import {
  assertBalanced,
  balancesFrom,
  buildDeposit,
  buildLock,
  buildPayout,
  buildPlatformFee,
  buildRefund,
  buildRelease,
  buildReserveDraw,
  buildReversal,
  DISPUTE_RESERVE_PERCENT,
  fundingRequiredFor,
  fundingShortfall,
  LedgerError,
  PLATFORM_FEE_BPS_CAMPAIGN,
  PLATFORM_FEE_BPS_CREATOR_DIRECT,
  type DraftTransaction,
} from "./transactions";
import { MoneyError } from "@/lib/money";

const CLEARING = "acct_paystack_clearing";
const WALLET = "acct_space_wallet";
const ESCROW = "acct_campaign_escrow";
const CREATOR = "acct_creator_wallet";
const FEES = "acct_platform_fees";
const RESERVE = "acct_dispute_reserve";
const PAYOUT_CLEARING = "acct_payout_clearing";

/** Every transaction the system posts must satisfy this, without exception. */
function expectBalanced(tx: DraftTransaction) {
  expect(tx.entries.reduce((sum, e) => sum + e.amountKobo, 0)).toBe(0);
  expect(() => assertBalanced(tx)).not.toThrow();
}

function amountFor(tx: DraftTransaction, accountId: string): number {
  return balancesFrom(tx.entries).get(accountId) ?? 0;
}

describe("assertBalanced", () => {
  it("accepts a transaction whose entries cancel out", () => {
    expect(() =>
      assertBalanced({
        type: "deposit",
        memo: "t",
        entries: [
          { accountId: "a", amountKobo: -500 },
          { accountId: "b", amountKobo: 500 },
        ],
      }),
    ).not.toThrow();
  });

  it("rejects a transaction that would create money", () => {
    expect(() =>
      assertBalanced({
        type: "deposit",
        memo: "t",
        entries: [
          { accountId: "a", amountKobo: -500 },
          { accountId: "b", amountKobo: 600 },
        ],
      }),
    ).toThrow(/created/);
  });

  it("rejects a transaction that would destroy money", () => {
    expect(() =>
      assertBalanced({
        type: "deposit",
        memo: "t",
        entries: [
          { accountId: "a", amountKobo: -600 },
          { accountId: "b", amountKobo: 500 },
        ],
      }),
    ).toThrow(/destroyed/);
  });

  it("rejects a single-sided transaction", () => {
    expect(() =>
      assertBalanced({
        type: "deposit",
        memo: "t",
        entries: [{ accountId: "a", amountKobo: 0 }],
      }),
    ).toThrow(/at least two entries/);
  });

  it("rejects an entry recording a movement of zero", () => {
    expect(() =>
      assertBalanced({
        type: "deposit",
        memo: "t",
        entries: [
          { accountId: "a", amountKobo: 0 },
          { accountId: "b", amountKobo: 0 },
        ],
      }),
    ).toThrow(/zero/);
  });

  it("rejects a fractional kobo entry", () => {
    expect(() =>
      assertBalanced({
        type: "deposit",
        memo: "t",
        entries: [
          { accountId: "a", amountKobo: -10.5 },
          { accountId: "b", amountKobo: 10.5 },
        ],
      }),
    ).toThrow(/whole number of kobo/);
  });
});

describe("buildDeposit", () => {
  it("moves money from clearing into the destination wallet", () => {
    const tx = buildDeposit({
      clearingAccountId: CLEARING,
      destinationAccountId: WALLET,
      amountKobo: 15_000_000,
      reference: "ps_ref_1",
    });
    expectBalanced(tx);
    expect(tx.type).toBe("deposit");
    expect(tx.reference).toBe("ps_ref_1");
    expect(amountFor(tx, CLEARING)).toBe(-15_000_000);
    expect(amountFor(tx, WALLET)).toBe(15_000_000);
  });

  it("refuses a zero or negative deposit", () => {
    const base = {
      clearingAccountId: CLEARING,
      destinationAccountId: WALLET,
      reference: "r",
    };
    expect(() => buildDeposit({ ...base, amountKobo: 0 })).toThrow(MoneyError);
    expect(() => buildDeposit({ ...base, amountKobo: -1 })).toThrow(MoneyError);
  });

  it("refuses a fractional deposit", () => {
    expect(() =>
      buildDeposit({
        clearingAccountId: CLEARING,
        destinationAccountId: WALLET,
        amountKobo: 100.5,
        reference: "r",
      }),
    ).toThrow(/whole number of kobo/);
  });
});

describe("buildLock", () => {
  it("moves budget from the space wallet into campaign escrow", () => {
    const tx = buildLock({
      spaceWalletAccountId: WALLET,
      escrowAccountId: ESCROW,
      amountKobo: 450_000_000,
    });
    expectBalanced(tx);
    expect(tx.type).toBe("lock");
    expect(amountFor(tx, WALLET)).toBe(-450_000_000);
    expect(amountFor(tx, ESCROW)).toBe(450_000_000);
  });

  it("refuses to lock nothing", () => {
    expect(() =>
      buildLock({ spaceWalletAccountId: WALLET, escrowAccountId: ESCROW, amountKobo: 0 }),
    ).toThrow(MoneyError);
  });
});

describe("buildRelease", () => {
  it("pays the creator fee out of escrow", () => {
    const tx = buildRelease({
      escrowAccountId: ESCROW,
      creatorWalletAccountId: CREATOR,
      feeKobo: 6_000_000,
    });
    expectBalanced(tx);
    expect(amountFor(tx, ESCROW)).toBe(-6_000_000);
    expect(amountFor(tx, CREATOR)).toBe(6_000_000);
  });

  it("carries no platform fee — that is a separate transaction", () => {
    const tx = buildRelease({
      escrowAccountId: ESCROW,
      creatorWalletAccountId: CREATOR,
      feeKobo: 6_000_000,
    });
    expect(tx.entries).toHaveLength(2);
  });

  it("refuses a negative fee", () => {
    expect(() =>
      buildRelease({
        escrowAccountId: ESCROW,
        creatorWalletAccountId: CREATOR,
        feeKobo: -1,
      }),
    ).toThrow(MoneyError);
  });
});

describe("buildPlatformFee", () => {
  const base = {
    payerAccountId: ESCROW,
    platformFeesAccountId: FEES,
    disputeReserveAccountId: RESERVE,
  };

  it("charges 12% on a campaign deal and splits it 98/2", () => {
    const tx = buildPlatformFee({
      ...base,
      creatorFeeKobo: 6_000_000, // ₦60,000
      platformFeeBps: PLATFORM_FEE_BPS_CAMPAIGN,
    });
    expectBalanced(tx);
    const total = 720_000; // ₦7,200
    expect(amountFor(tx, ESCROW)).toBe(-total);
    expect(amountFor(tx, FEES)).toBe(705_600); // 98%
    expect(amountFor(tx, RESERVE)).toBe(14_400); // 2%
    expect(amountFor(tx, FEES) + amountFor(tx, RESERVE)).toBe(total);
  });

  it("charges 6% on a creator-initiated deal", () => {
    const tx = buildPlatformFee({
      ...base,
      creatorFeeKobo: 2_000_000, // ₦20,000
      platformFeeBps: PLATFORM_FEE_BPS_CREATOR_DIRECT,
    });
    expectBalanced(tx);
    expect(amountFor(tx, ESCROW)).toBe(-120_000); // ₦1,200
  });

  it("never loses or invents a kobo when the split does not divide evenly", () => {
    // 101 kobo of fee: 2% floors to 2, so revenue must absorb the remaining 99.
    const tx = buildPlatformFee({
      ...base,
      creatorFeeKobo: 10_100,
      platformFeeBps: 10_000, // 100%, to make the fee exactly 10,100... then floor
    });
    expectBalanced(tx);
    const debited = -amountFor(tx, ESCROW);
    expect(amountFor(tx, FEES) + amountFor(tx, RESERVE)).toBe(debited);
  });

  it("holds back exactly the configured reserve percentage", () => {
    const tx = buildPlatformFee({
      ...base,
      creatorFeeKobo: 100_000_000,
      platformFeeBps: PLATFORM_FEE_BPS_CAMPAIGN,
    });
    const total = -amountFor(tx, ESCROW);
    expect(amountFor(tx, RESERVE)).toBe(
      Math.floor((total * DISPUTE_RESERVE_PERCENT) / 100),
    );
  });

  it("puts the whole fee in revenue when the reserve share rounds to nothing", () => {
    // A fee so small that 2% of it is under one kobo.
    const tx = buildPlatformFee({
      ...base,
      creatorFeeKobo: 400,
      platformFeeBps: 100, // 1% → 4 kobo; 2% of 4 floors to 0
    });
    expectBalanced(tx);
    expect(amountFor(tx, RESERVE)).toBe(0);
    expect(amountFor(tx, FEES)).toBe(4);
    expect(tx.entries).toHaveLength(2);
  });

  it("refuses to post a fee that rounds away entirely", () => {
    expect(() =>
      buildPlatformFee({ ...base, creatorFeeKobo: 1, platformFeeBps: 1200 }),
    ).toThrow(LedgerError);
  });

  it("can charge the creator instead of escrow", () => {
    const tx = buildPlatformFee({
      payerAccountId: CREATOR,
      platformFeesAccountId: FEES,
      disputeReserveAccountId: RESERVE,
      creatorFeeKobo: 2_000_000,
      platformFeeBps: PLATFORM_FEE_BPS_CREATOR_DIRECT,
    });
    expectBalanced(tx);
    expect(amountFor(tx, CREATOR)).toBe(-120_000);
    expect(amountFor(tx, ESCROW)).toBe(0);
  });
});

describe("buildPayout", () => {
  it("moves the creator balance into payout clearing", () => {
    const tx = buildPayout({
      creatorWalletAccountId: CREATOR,
      payoutClearingAccountId: PAYOUT_CLEARING,
      amountKobo: 6_000_000,
      reference: "trf_123",
    });
    expectBalanced(tx);
    expect(tx.reference).toBe("trf_123");
    expect(amountFor(tx, CREATOR)).toBe(-6_000_000);
    expect(amountFor(tx, PAYOUT_CLEARING)).toBe(6_000_000);
  });

  it("refuses to pay out nothing", () => {
    expect(() =>
      buildPayout({
        creatorWalletAccountId: CREATOR,
        payoutClearingAccountId: PAYOUT_CLEARING,
        amountKobo: 0,
      }),
    ).toThrow(MoneyError);
  });
});

describe("buildReversal", () => {
  it("undoes a failed transfer exactly, leaving the pair at zero", () => {
    const payout = buildPayout({
      creatorWalletAccountId: CREATOR,
      payoutClearingAccountId: PAYOUT_CLEARING,
      amountKobo: 6_000_000,
      reference: "trf_123",
    });
    const reversal = buildReversal(payout, "Transfer failed at the bank");
    expectBalanced(reversal);
    expect(amountFor(reversal, CREATOR)).toBe(6_000_000);
    expect(amountFor(reversal, PAYOUT_CLEARING)).toBe(-6_000_000);

    const combined = balancesFrom([...payout.entries, ...reversal.entries]);
    expect(combined.get(CREATOR)).toBe(0);
    expect(combined.get(PAYOUT_CLEARING)).toBe(0);
  });

  it("keeps the original reference so the pair can be found together", () => {
    const payout = buildPayout({
      creatorWalletAccountId: CREATOR,
      payoutClearingAccountId: PAYOUT_CLEARING,
      amountKobo: 1_000,
      reference: "trf_x",
    });
    expect(buildReversal(payout, "failed").reference).toBe("trf_x");
  });
});

describe("buildRefund", () => {
  it("returns unused escrow to the wallet it came from", () => {
    const tx = buildRefund({
      escrowAccountId: ESCROW,
      destinationAccountId: WALLET,
      amountKobo: 120_000_000,
    });
    expectBalanced(tx);
    expect(amountFor(tx, ESCROW)).toBe(-120_000_000);
    expect(amountFor(tx, WALLET)).toBe(120_000_000);
  });
});

describe("buildReserveDraw", () => {
  it("settles a dispute from the reserve rather than from either party", () => {
    const tx = buildReserveDraw({
      disputeReserveAccountId: RESERVE,
      destinationAccountId: CREATOR,
      amountKobo: 500_000,
      memo: "Dispute SSQ-4471 resolved for the creator",
    });
    expectBalanced(tx);
    expect(tx.type).toBe("reserve");
    expect(amountFor(tx, RESERVE)).toBe(-500_000);
    expect(amountFor(tx, CREATOR)).toBe(500_000);
  });
});

describe("funding arithmetic", () => {
  it("requires the creator fees plus the platform fee on top", () => {
    expect(fundingRequiredFor(100_000_000, PLATFORM_FEE_BPS_CAMPAIGN)).toBe(112_000_000);
  });

  it("requires less on a creator-initiated deal", () => {
    expect(fundingRequiredFor(2_000_000, PLATFORM_FEE_BPS_CREATOR_DIRECT)).toBe(2_120_000);
  });

  it("reports the gap when a wallet cannot cover a campaign", () => {
    const required = fundingRequiredFor(100_000_000, PLATFORM_FEE_BPS_CAMPAIGN);
    expect(fundingShortfall(50_000_000, required)).toBe(62_000_000);
  });

  it("reports no gap when the wallet covers it exactly", () => {
    const required = fundingRequiredFor(100_000_000, PLATFORM_FEE_BPS_CAMPAIGN);
    expect(fundingShortfall(required, required)).toBe(0);
    expect(fundingShortfall(required + 1, required)).toBe(0);
  });
});

describe("a full campaign deal, end to end", () => {
  it("leaves every account where the money rules say it should", () => {
    const creatorFee = 6_000_000; // ₦60,000
    const budget = fundingRequiredFor(creatorFee, PLATFORM_FEE_BPS_CAMPAIGN); // ₦67,200

    const all = [
      buildDeposit({
        clearingAccountId: CLEARING,
        destinationAccountId: WALLET,
        amountKobo: 45_000_000,
        reference: "ps_1",
      }),
      buildLock({
        spaceWalletAccountId: WALLET,
        escrowAccountId: ESCROW,
        amountKobo: budget,
      }),
      buildRelease({
        escrowAccountId: ESCROW,
        creatorWalletAccountId: CREATOR,
        feeKobo: creatorFee,
      }),
      buildPlatformFee({
        payerAccountId: ESCROW,
        platformFeesAccountId: FEES,
        disputeReserveAccountId: RESERVE,
        creatorFeeKobo: creatorFee,
        platformFeeBps: PLATFORM_FEE_BPS_CAMPAIGN,
      }),
    ];

    for (const tx of all) expectBalanced(tx);

    const balances = balancesFrom(all.flatMap((t) => t.entries));

    // The creator has exactly their fee, and nothing was taken out of it.
    expect(balances.get(CREATOR)).toBe(creatorFee);
    // Escrow funded the fee and the platform fee, and is now empty.
    expect(balances.get(ESCROW)).toBe(0);
    // The wallet holds what was deposited less what was locked.
    expect(balances.get(WALLET)).toBe(45_000_000 - budget);
    // Platform revenue and the reserve together are the whole 12%.
    expect((balances.get(FEES) ?? 0) + (balances.get(RESERVE) ?? 0)).toBe(720_000);
    // Nothing anywhere created money.
    expect([...balances.values()].reduce((a, b) => a + b, 0)).toBe(0);
  });

  it("returns the unused budget when the campaign is cancelled", () => {
    const budget = 45_000_000;
    const spent = 6_720_000;
    const all = [
      buildLock({
        spaceWalletAccountId: WALLET,
        escrowAccountId: ESCROW,
        amountKobo: budget,
      }),
      buildRelease({
        escrowAccountId: ESCROW,
        creatorWalletAccountId: CREATOR,
        feeKobo: 6_000_000,
      }),
      buildPlatformFee({
        payerAccountId: ESCROW,
        platformFeesAccountId: FEES,
        disputeReserveAccountId: RESERVE,
        creatorFeeKobo: 6_000_000,
        platformFeeBps: PLATFORM_FEE_BPS_CAMPAIGN,
      }),
      buildRefund({
        escrowAccountId: ESCROW,
        destinationAccountId: WALLET,
        amountKobo: budget - spent,
      }),
    ];
    const balances = balancesFrom(all.flatMap((t) => t.entries));
    expect(balances.get(ESCROW)).toBe(0);
    expect(balances.get(WALLET)).toBe(-spent);
  });
});
