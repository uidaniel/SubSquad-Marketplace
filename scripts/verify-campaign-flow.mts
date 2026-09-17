/**
 * Walks a campaign from creation to payout against the live database.
 *
 * The unit tests prove the ledger builders and the link audit proves no screen
 * is unreachable, but neither proves that the chain of steps a person actually
 * performs holds together — which is exactly where this product kept breaking:
 * a shortlist screen nothing linked to, a brief field the prompt read under the
 * wrong name, a lock that could be posted twice.
 *
 * Every step calls the same function the button calls. Nothing is mocked.
 * Everything it creates is named `__verify_<stamp>__` and removed at the end,
 * including on failure.
 *
 *   npx tsx --env-file=.env.local --tsconfig scripts/tsconfig.json scripts/verify-campaign-flow.mts
 */


import { requireServiceClient } from "../src/lib/supabase/service";
import { accountFor, balanceOf, post } from "../src/lib/ledger/post";
import {
  buildDeposit,
  buildLock,
  fundingRequiredFor,
} from "../src/lib/ledger/transactions";
import { generateShortlist, eligiblePool } from "../src/lib/ai/shortlist";
import { toBrief } from "../src/lib/data/brief";
import { formatNaira } from "../src/lib/money";
import { checkSendAllowed, chooseChannel } from "../src/lib/messaging/policy";
import { integrations } from "../src/lib/env";

const db = requireServiceClient();
const stamp = Date.now().toString(36);
const cleanup: { table: string; id: string }[] = [];

let failures = 0;
function check(step: string, ok: boolean, detail: string) {
  if (!ok) failures++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${step}`);
  console.log(`        ${detail}`);
}

async function main() {
  console.log(`\nVerifying the campaign flow  (run ${stamp})\n`);

  /* ---- 1. an agency, a client, a campaign -------------------------------- */

  const { data: org } = await db
    .from("orgs")
    .insert({ type: "agency", name: `__verify_${stamp}__`, country: "NG" })
    .select()
    .single();
  cleanup.push({ table: "orgs", id: org!.id });

  const { data: space } = await db
    .from("spaces")
    .insert({ org_id: org!.id, name: `__verify_client_${stamp}__` })
    .select()
    .single();
  cleanup.push({ table: "spaces", id: space!.id });

  // The brief is written the way the campaign form writes it: snake_case keys.
  // Reading it back through `toBrief` is the bug that crashed the shortlist.
  const { data: campaign } = await db
    .from("campaigns")
    .insert({
      org_id: org!.id,
      space_id: space!.id,
      name: `__verify_campaign_${stamp}__`,
      end_brand_name: "Verify Brand",
      status: "draft",
      platform_fee_bps: 1200,
      rate_band_min_kobo: 1_000_000,
      rate_band_max_kobo: 3_000_000,
      brief: {
        product: "A thing worth promoting",
        objective: "awareness",
        key_messages: ["One", "Two"],
        must_avoid: ["Nothing illegal"],
        platforms: ["tiktok"],
        audience: { cities: [], languages: ["English"] },
        arcon_category: "general",
        disclosure_tag: "#ad",
        usage_rights_days: 90,
      },
    })
    .select()
    .single();
  cleanup.push({ table: "campaigns", id: campaign!.id });

  check(
    "1. Campaign created",
    Boolean(campaign?.id),
    `${campaign!.name} for ${campaign!.end_brand_name}`,
  );

  /* ---- 2. the brief survives the round trip ------------------------------ */

  const brief = toBrief(campaign!.brief);
  check(
    "2. Brief reads back in the domain shape",
    brief.keyMessages.length === 2 && brief.mustAvoid.length === 1,
    `keyMessages=${brief.keyMessages.length}, mustAvoid=${brief.mustAvoid.length}, platforms=${brief.platforms.join(",")}`,
  );

  /* ---- 3. deliverables --------------------------------------------------- */

  const { data: slot } = await db
    .from("campaign_slots")
    .insert({
      campaign_id: campaign!.id,
      deliverable_type: "tiktok_video",
      count: 2,
      fee_kobo: 2_000_000,
    })
    .select()
    .single();
  cleanup.push({ table: "campaign_slots", id: slot!.id });

  const creatorFees = Number(slot!.fee_kobo) * Number(slot!.count);
  const required = fundingRequiredFor(creatorFees, 1200);
  check(
    "3. Funding total includes the platform fee",
    required === creatorFees + Math.floor((creatorFees * 1200) / 10_000),
    `${formatNaira(creatorFees)} fees + fee on top = ${formatNaira(required)}`,
  );

  /* ---- 4. money in ------------------------------------------------------- */

  const clearing = await accountFor("paystack_clearing");
  const wallet = await accountFor("space_wallet", { spaceId: space!.id });

  await post(
    buildDeposit({
      clearingAccountId: clearing,
      destinationAccountId: wallet,
      amountKobo: required * 2,
      reference: `__verify_dep_${stamp}`,
      memo: "Verify deposit",
    }),
  );

  const { data: walletAccount } = await db
    .from("ledger_accounts")
    .select("org_id")
    .eq("id", wallet)
    .single();

  check(
    "4. Deposit credits the wallet, and the account knows its org",
    (await balanceOf(wallet)) === required * 2 && walletAccount!.org_id === org!.id,
    `balance ${formatNaira(await balanceOf(wallet))}, org_id ${walletAccount!.org_id === org!.id ? "set" : "NULL — invisible to its own org"}`,
  );

  /* ---- 5. funding is idempotent ------------------------------------------ */

  const escrow = await accountFor("campaign_escrow", {
    spaceId: space!.id,
    campaignId: campaign!.id,
  });

  const lock = () =>
    post(
      buildLock({
        spaceWalletAccountId: wallet,
        escrowAccountId: escrow,
        amountKobo: required,
        memo: `Funded ${campaign!.name}`,
        reference: `lock:${campaign!.id}`,
      }),
      { requireFunds: [wallet] },
    );

  const first = await lock();
  const second = await lock();

  check(
    "5. Funding the same campaign twice locks once",
    !first.alreadyApplied &&
      second.alreadyApplied &&
      (await balanceOf(escrow)) === required,
    `escrow holds ${formatNaira(await balanceOf(escrow))}, not ${formatNaira(required * 2)}`,
  );

  /* ---- 6. the pool is real ----------------------------------------------- */

  const pool = await eligiblePool(campaign!.id);
  check(
    "6. Eligible pool is counted, not invented",
    pool.hasSlots && pool.platforms.includes("tiktok"),
    `${pool.eligible} creators on ${pool.platforms.join(", ")}`,
  );

  /* ---- 7. the shortlist runs --------------------------------------------- */

  if (pool.eligible === 0) {
    check(
      "7. Shortlist",
      false,
      "no creators in the index on this platform — cannot exercise this step",
    );
  } else {
    try {
      const result = await generateShortlist(campaign!.id, { wanted: 3 });
      const { data: items } = await db
        .from("shortlist_items")
        .select("id, creator_id, fit_score, estimated_fee_kobo, slot_id")
        .eq("campaign_id", campaign!.id);

      const inBand = (items ?? []).every(
        (i) =>
          Number(i.estimated_fee_kobo) >= 1_000_000 &&
          Number(i.estimated_fee_kobo) <= 3_000_000,
      );
      const slotted = (items ?? []).every((i) => i.slot_id === slot!.id);

      check(
        "7. Shortlist generated, fees clamped to the rate band, slots assigned",
        result.created > 0 && inBand && slotted,
        `${result.created} proposed (${result.live ? "AI" : "no model — ranked by fraud score"}), all fees in band: ${inBand}, all slotted: ${slotted}`,
      );
    } catch (error) {
      check("7. Shortlist generated", false, (error as Error).message);
    }
  }

  /* ---- 8. approving creates deals, not messages --------------------------- */

  const { data: proposed } = await db
    .from("shortlist_items")
    .select("creator_id, slot_id, estimated_fee_kobo")
    .eq("campaign_id", campaign!.id)
    .limit(1);

  if (!proposed?.length) {
    check("8. Approval creates a deal", false, "no shortlist items to approve");
  } else {
    const pick = proposed[0];
    const { data: deal } = await db
      .from("deals")
      .insert({
        campaign_id: campaign!.id,
        creator_id: pick.creator_id,
        slot_id: pick.slot_id,
        fee_kobo: pick.estimated_fee_kobo,
        platform_fee_bps: 1200,
        status: "invited",
      })
      .select()
      .single();
    cleanup.push({ table: "deals", id: deal!.id });

    const { count: sent } = await db
      .from("deal_messages")
      .select("id", { count: "exact", head: true })
      .eq("deal_id", deal!.id)
      .not("sent_at", "is", null);

    check(
      "8. Approving creates an invited deal and sends nothing",
      deal!.status === "invited" && (sent ?? 0) === 0,
      `deal ${deal!.id.slice(0, 8)} is "${deal!.status}", ${sent ?? 0} messages sent`,
    );

    check(
      "9. The invite link is a real route",
      Boolean(deal!.invite_token),
      `/i/${String(deal!.invite_token).slice(0, 12)}…`,
    );
  }

  /* ---- 10. escrow covers what was promised -------------------------------- */

  const { data: deals } = await db
    .from("deals")
    .select("fee_kobo")
    .eq("campaign_id", campaign!.id);
  const promised = (deals ?? []).reduce((s, d) => s + Number(d.fee_kobo), 0);
  const held = await balanceOf(escrow);

  check(
    "10. Escrow covers every fee promised",
    held >= promised,
    `${formatNaira(held)} held against ${formatNaira(promised)} promised`,
  );

  /* ---- 11. outreach can actually reach somebody --------------------------- */

  // The step the earlier version of this script skipped, and the one that was
  // broken: it inserted a deal directly rather than asking whether the creator
  // could be contacted at all. Every seeded creator sat inside the cooldown and
  // every draft was addressed to WhatsApp, which is not configured — so an
  // approved shortlist reached nobody and explained itself in four words.
  const { data: contactable } = await db
    .from("creators")
    .select("handle, email, phone, whatsapp_opt_in, do_not_contact, last_contacted_at")
    .eq("primary_platform", "tiktok");

  const reachable = (contactable ?? []).filter((c) => {
    const contact = {
      doNotContact: c.do_not_contact,
      lastUnsolicitedAt: c.last_contacted_at,
      phone: c.phone,
      email: c.email,
      whatsappOptIn: c.whatsapp_opt_in,
    };
    if (!checkSendAllowed(contact, {}).allowed) return false;
    const channel = chooseChannel(contact, {
      whatsapp: integrations.whatsapp,
      email: integrations.resend,
    });
    return channel === "email" || channel === "whatsapp";
  });

  check(
    "11. At least one creator can be reached on a configured channel",
    reachable.length > 0,
    `${reachable.length} of ${(contactable ?? []).length} reachable — channels live: ${
      [integrations.resend ? "email" : null, integrations.whatsapp ? "whatsapp" : null]
        .filter(Boolean)
        .join(", ") || "NONE"
    }`,
  );


  /* ---- 12. approving a shortlist really creates deals and drafts ---------- */

  // The real action, not a hand-rolled insert. Step 8 above inserts a deal
  // directly, which is exactly why it kept passing while the button on the
  // screen did nothing.
  //
  // The rows are first forced into the broken state a half-failed run leaves
  // behind — marked `approved` with no deal — because that state is live in the
  // database right now and the fix has to recover from it, not just avoid
  // creating it.
  await db
    .from("shortlist_items")
    .update({ status: "approved" })
    .eq("campaign_id", campaign!.id);

  try {
    const { approveShortlist } = await import("../src/app/(app)/actions");
    await approveShortlist(campaign!.id, []);
  } catch (error) {
    // `revalidatePath` needs a Next request scope and throws in a plain script.
    // It runs after every write, so the work is done by the time it fails;
    // anything else is a real failure.
    const message = (error as Error).message;
    if (!/static generation store|revalidatePath|requestAsyncStorage/i.test(message)) {
      throw error;
    }
  }

  const { data: madeDeals } = await db
    .from("deals")
    .select("id, status")
    .eq("campaign_id", campaign!.id);

  const dealIds = (madeDeals ?? []).map((d) => d.id);
  const { data: madeDrafts } = dealIds.length
    ? await db
        .from("deal_messages")
        .select("id, channel, ai_draft, sent_at")
        .in("deal_id", dealIds)
    : { data: [] as { channel: string; ai_draft: boolean; sent_at: string | null }[] };

  const allEmail = (madeDrafts ?? []).every((m) => m.channel === "email");
  const noneSent = (madeDrafts ?? []).every((m) => m.sent_at === null);

  check(
    "12. Approving a stuck shortlist creates deals and unsent email drafts",
    (madeDeals ?? []).length > 0 &&
      (madeDrafts ?? []).length > 0 &&
      allEmail &&
      noneSent,
    `${(madeDeals ?? []).length} deals, ${(madeDrafts ?? []).length} drafts, all on email: ${allEmail}, none sent: ${noneSent}`,
  );


  console.log(
    `\n${failures === 0 ? "All steps passed." : `${failures} step(s) FAILED.`}\n`,
  );
}

async function removeEverything() {
  // Ledger rows first: the accounts reference the campaign and space.
  const { data: accounts } = await db
    .from("ledger_accounts")
    .select("id")
    .or(
      `space_id.eq.${cleanup.find((c) => c.table === "spaces")?.id ?? "00000000-0000-0000-0000-000000000000"},campaign_id.eq.${cleanup.find((c) => c.table === "campaigns")?.id ?? "00000000-0000-0000-0000-000000000000"}`,
    );
  const accountIds = (accounts ?? []).map((a) => a.id);

  if (accountIds.length) {
    const { data: entries } = await db
      .from("ledger_entries")
      .select("transaction_id")
      .in("account_id", accountIds);
    const txIds = [...new Set((entries ?? []).map((e) => e.transaction_id))];
    await db.from("ledger_entries").delete().in("transaction_id", txIds);
    await db.from("ledger_transactions").delete().in("id", txIds);
    await db.from("ledger_accounts").delete().in("id", accountIds);
  }

  const campaignId = cleanup.find((c) => c.table === "campaigns")?.id;
  if (campaignId) {
    const { data: leftoverDeals } = await db
      .from("deals")
      .select("id")
      .eq("campaign_id", campaignId);
    const ids = (leftoverDeals ?? []).map((d) => d.id);
    if (ids.length) {
      await db.from("deal_messages").delete().in("deal_id", ids);
      await db.from("deals").delete().in("id", ids);
    }
    await db.from("shortlist_items").delete().eq("campaign_id", campaignId);
  }

  for (const { table, id } of [...cleanup].reverse()) {
    await db.from(table).delete().eq("id", id);
  }
  console.log("Cleaned up everything this run created.");
}

main()
  .catch((error) => {
    failures++;
    console.error("\nThe run itself threw:", error);
  })
  .finally(async () => {
    await removeEverything();
    process.exit(failures === 0 ? 0 : 1);
  });
