import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { requireServiceClient } from "@/lib/supabase/service";
import { accountFor, balanceOf, post } from "@/lib/ledger/post";
import {
  buildDeposit,
  buildLock,
  fundingRequiredFor,
  PLATFORM_FEE_BPS_CAMPAIGN,
} from "@/lib/ledger/transactions";
import { releaseDeal } from "@/lib/deals/release";
import { formatNaira } from "@/lib/money";

/**
 * Walks a whole campaign's money through the live database and checks the
 * arithmetic at every step: deposit, fund, release, fee.
 *
 * This exists because the ledger's unit tests prove the builders and the
 * database trigger proves the invariant, but neither proves that the product's
 * own code path — the one a button actually calls — moves the right amounts
 * between the right accounts. This does, against real Postgres.
 *
 * Development only. It writes real rows and then removes them.
 */
export async function GET() {
  if (env.isProd) {
    return NextResponse.json({ error: "not available" }, { status: 404 });
  }

  const db = requireServiceClient();
  const checks: { step: string; ok: boolean; detail: string }[] = [];
  const check = (step: string, ok: boolean, detail: string) =>
    checks.push({ step, ok, detail });

  const stamp = Date.now().toString(36);
  const created: { table: string; id: string }[] = [];

  try {
    /* ---- a throwaway agency, client and campaign ------------------------ */
    const { data: org } = await db
      .from("orgs")
      .insert({ type: "agency", name: `__flow_${stamp}__`, country: "NG" })
      .select()
      .single();
    created.push({ table: "orgs", id: org!.id });

    const { data: space } = await db
      .from("spaces")
      .insert({ org_id: org!.id, name: "Flow client" })
      .select()
      .single();
    created.push({ table: "spaces", id: space!.id });

    const { data: campaign } = await db
      .from("campaigns")
      .insert({
        org_id: org!.id,
        space_id: space!.id,
        name: "Flow campaign",
        end_brand_name: "Flow brand",
        status: "draft",
        platform_fee_bps: PLATFORM_FEE_BPS_CAMPAIGN,
        brief: {},
      })
      .select()
      .single();
    created.push({ table: "campaigns", id: campaign!.id });

    const { data: creator } = await db
      .from("creators")
      .insert({
        display_name: `Flow Creator ${stamp}`,
        primary_platform: "tiktok",
        handle: `flow_${stamp}`,
        status: "onboarded",
        payout_verified: true,
      })
      .select()
      .single();
    created.push({ table: "creators", id: creator!.id });

    const creatorFee = 6_000_000; // ₦60,000
    const { data: deal } = await db
      .from("deals")
      .insert({
        campaign_id: campaign!.id,
        creator_id: creator!.id,
        origin: "campaign",
        fee_kobo: creatorFee,
        platform_fee_bps: PLATFORM_FEE_BPS_CAMPAIGN,
        fee_paid_by: "brand",
        status: "published",
        published_url: "https://example.com/post",
        published_at: new Date().toISOString(),
      })
      .select()
      .single();
    created.push({ table: "deals", id: deal!.id });

    /* ---- accounts ------------------------------------------------------- */
    const clearing = await accountFor("paystack_clearing");
    const wallet = await accountFor("space_wallet", {
      orgId: org!.id,
      spaceId: space!.id,
    });
    const escrow = await accountFor("campaign_escrow", {
      orgId: org!.id,
      spaceId: space!.id,
      campaignId: campaign!.id,
    });
    const creatorWallet = await accountFor("creator_wallet", {
      creatorId: creator!.id,
    });
    const fees = await accountFor("platform_fees");
    const reserve = await accountFor("dispute_reserve");

    const feesBefore = await balanceOf(fees);
    const reserveBefore = await balanceOf(reserve);

    /* ---- 1. deposit ----------------------------------------------------- */
    const deposit = 10_000_000; // ₦100,000
    await post(
      buildDeposit({
        clearingAccountId: clearing,
        destinationAccountId: wallet,
        amountKobo: deposit,
        reference: `flow_${stamp}`,
        memo: "Flow test deposit",
      }),
    );
    check(
      "a deposit lands in the client wallet",
      (await balanceOf(wallet)) === deposit,
      formatNaira(await balanceOf(wallet)),
    );

    /* ---- 2. the same webhook arriving twice ----------------------------- */
    const repeat = await post(
      buildDeposit({
        clearingAccountId: clearing,
        destinationAccountId: wallet,
        amountKobo: deposit,
        reference: `flow_${stamp}`,
        memo: "Flow test deposit (retry)",
      }),
    );
    check(
      "a repeated reference does not pay twice",
      repeat.alreadyApplied && (await balanceOf(wallet)) === deposit,
      `balance still ${formatNaira(await balanceOf(wallet))}`,
    );

    /* ---- 3. funding beyond the wallet is refused ------------------------ */
    let refused = false;
    try {
      await post(
        buildLock({
          spaceWalletAccountId: wallet,
          escrowAccountId: escrow,
          amountKobo: deposit * 2,
        }),
        { requireFunds: [wallet] },
      );
    } catch {
      refused = true;
    }
    check(
      "funding more than the wallet holds is refused",
      refused,
      refused ? "refused, as intended" : "it went through, which is a bug",
    );

    /* ---- 4. fund the campaign ------------------------------------------ */
    const required = fundingRequiredFor(creatorFee, PLATFORM_FEE_BPS_CAMPAIGN);
    await post(
      buildLock({
        spaceWalletAccountId: wallet,
        escrowAccountId: escrow,
        amountKobo: required,
        memo: "Flow test funding",
      }),
      { requireFunds: [wallet] },
    );
    check(
      "funding covers the creator fee plus the platform fee",
      required === 6_720_000 && (await balanceOf(escrow)) === required,
      `${formatNaira(required)} locked for a ${formatNaira(creatorFee)} fee`,
    );

    /* ---- 5. release ----------------------------------------------------- */
    await releaseDeal(deal!.id, { memo: "Flow test release" });

    check(
      "the creator receives exactly their fee",
      (await balanceOf(creatorWallet)) === creatorFee,
      formatNaira(await balanceOf(creatorWallet)),
    );
    check(
      "escrow is emptied by the fee and the platform fee together",
      (await balanceOf(escrow)) === 0,
      formatNaira(await balanceOf(escrow)),
    );

    const feeTotal = (await balanceOf(fees)) - feesBefore;
    const reserveTotal = (await balanceOf(reserve)) - reserveBefore;
    check(
      "the platform fee is 12% of the creator fee",
      feeTotal + reserveTotal === 720_000,
      formatNaira(feeTotal + reserveTotal),
    );
    check(
      "2% of that fee is held back for disputes",
      reserveTotal === 14_400 && feeTotal === 705_600,
      `${formatNaira(feeTotal)} revenue, ${formatNaira(reserveTotal)} reserve`,
    );

    /* ---- 6. a payout was queued ----------------------------------------- */
    const { data: payouts } = await db
      .from("payouts")
      .select("amount_kobo, status")
      .eq("deal_id", deal!.id);
    check(
      "a payout is queued for the creator",
      payouts?.length === 1 && Number(payouts[0].amount_kobo) === creatorFee,
      payouts?.length ? `${formatNaira(Number(payouts[0].amount_kobo))} pending` : "none",
    );

    /* ---- 7. releasing twice does nothing -------------------------------- */
    const second = await releaseDeal(deal!.id);
    check(
      "releasing an already-paid deal is a no-op",
      second.releasedKobo === 0 && (await balanceOf(creatorWallet)) === creatorFee,
      "the creator was not paid twice",
    );

    /* ---- clean up ------------------------------------------------------- */
    await db.from("payouts").delete().eq("deal_id", deal!.id);
    const accountIds = [wallet, escrow, creatorWallet];
    const { data: entries } = await db
      .from("ledger_entries")
      .select("transaction_id")
      .in("account_id", accountIds);
    const txIds = [...new Set((entries ?? []).map((e) => e.transaction_id))];
    await db.from("ledger_entries").delete().in("transaction_id", txIds);
    await db.from("ledger_transactions").delete().in("id", txIds);
    await db.from("ledger_accounts").delete().in("id", accountIds);
    for (const { table, id } of created.reverse()) {
      await db.from(table).delete().eq("id", id);
    }

    const failures = checks.filter((c) => !c.ok);
    return NextResponse.json(
      {
        ok: failures.length === 0,
        summary: `${checks.length - failures.length} of ${checks.length} checks passed`,
        checks,
      },
      { status: failures.length === 0 ? 200 : 500 },
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: (error as Error).message, checks },
      { status: 500 },
    );
  }
}
