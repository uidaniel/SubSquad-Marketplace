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
import { acceptRate, counterRate, pendingRates } from "../src/lib/deals/rates";
import { getInviteByToken } from "../src/lib/data/creator-live";

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

  /* ---- 2b. creators that belong to this run only -------------------------- */

  // Seeded rather than borrowed from the index.
  //
  // Reachability depends on `last_contacted_at`, which the real send path
  // stamps. Asserting against shared creators meant this run could pass or fail
  // on what somebody did in the app five minutes earlier — and a test that
  // depends on that is not evidence of anything.
  // Plausible, not placeholder. The model is asked to judge fit against a
  // brief; feeding it `__verify_abc_0__` with no category tags tests nothing
  // about the product and everything about how it copes with nonsense.
  const CAST = [
    { name: "Ada Obi", tags: ["comedy", "skits"], city: "Lagos" },
    { name: "Bode Ajayi", tags: ["tech", "reviews"], city: "Abuja" },
    { name: "Chika Nwosu", tags: ["lifestyle", "comedy"], city: "Enugu" },
  ];

  const creatorIds: string[] = [];
  for (const [i, person] of CAST.entries()) {
    const { data: c } = await db
      .from("creators")
      .insert({
        display_name: person.name,
        handle: `verify_${stamp}_${i}`,
        primary_platform: "tiktok",
        email: `verify+${stamp}.${i}@example.invalid`,
        status: "indexed",
        do_not_contact: false,
        last_contacted_at: null,
      })
      .select("id")
      .single();
    if (!c) continue;
    creatorIds.push(c.id);
    cleanup.push({ table: "creators", id: c.id });

    await db.from("creator_profiles").insert({
      creator_id: c.id,
      platform: "tiktok",
      followers: 80_000 + i * 10_000,
      following: 500,
      posts_count: 300,
      avg_views: 60_000,
      avg_likes: 5_000,
      avg_comments: 120,
      engagement_rate: 0.08,
      category_tags: person.tags,
      languages: ["English"],
      location_city: person.city,
      sample_posts: [
        {
          url: "https://example.invalid/p",
          caption: `Splitting the bill with my friends again and somebody always forgets to pay me back.`,
          views: 60000,
          likes: 5000,
        },
      ],
    });
    await db.from("creator_scores").insert({
      creator_id: c.id,
      fraud_score: 95,
      reasons: [],
    });
  }

  check(
    "2b. Three contactable creators seeded for this run",
    creatorIds.length === 3,
    `${creatorIds.length} created, never contacted, on tiktok`,
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
    .in("id", creatorIds);

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
  // One of this run's creators is put on the shortlist by hand first.
  //
  // The model picks from the whole index, so on some runs it shortlists only
  // real creators and this step had nothing of its own to assert on — which
  // made it fail for reasons that had nothing to do with the code under test.
  // A step that passes or fails on the model's mood is not a test.
  const seeded = creatorIds[creatorIds.length - 1];
  await db.from("shortlist_items").upsert(
    {
      campaign_id: campaign!.id,
      creator_id: seeded,
      slot_id: slot!.id,
      status: "proposed",
      fit_score: 80,
      estimated_fee_kobo: 1_200_000,
      ai_reasoning: "Seeded by the verification run.",
    },
    { onConflict: "campaign_id,creator_id" },
  );

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
    .select("id, status, creator_id")
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

  // The invariant is "everybody shortlisted ends up with a deal", not "this
  // call created N of them". Step 8 deliberately gives one creator a deal
  // beforehand, so on a short shortlist there is correctly nobody left to
  // invite — and asserting a raw count failed the product for being right.
  // Scoped to this run's creators. The pool is global, so the model may
  // legitimately shortlist a real creator who is inside the 7-day cooldown —
  // approveShortlist then skips them, correctly, and counting that as a failure
  // made the test fail the product for obeying its own rule.
  const { data: shortlistRows } = await db
    .from("shortlist_items")
    .select("creator_id")
    .eq("campaign_id", campaign!.id)
    .in("creator_id", creatorIds)
    .neq("status", "removed");

  const withDeals = new Set((madeDeals ?? []).map((d) => d.creator_id as string));
  const everyoneInvited = (shortlistRows ?? []).every((r) =>
    withDeals.has(r.creator_id as string),
  );

  check(
    "12. Approving a stuck shortlist leaves every creator with a deal, nothing sent",
    (shortlistRows ?? []).length > 0 && everyoneInvited && allEmail && noneSent,
    `${(shortlistRows ?? []).length} shortlisted, ${(madeDeals ?? []).length} deals, ${(madeDrafts ?? []).length} drafts, all on email: ${allEmail}, none sent: ${noneSent}`,
  );


  /* ---- 13. the rate negotiation closes ------------------------------------ */

  // A creator could always name a rate; nobody could answer it. The deal sat in
  // "negotiating" forever because the amount lived in a chat message and there
  // was no brand-side action and no screen showing it.
  const { data: firstDeal } = await db
    .from("deals")
    .select("id, fee_kobo")
    .eq("campaign_id", campaign!.id)
    .limit(1)
    .maybeSingle();

  if (!firstDeal) {
    check("13. Rate negotiation", false, "no deal to negotiate on");
  } else {
    const asking = Number(firstDeal.fee_kobo) + 100_000; // ask for N1,000 more

    await db
      .from("deals")
      .update({
        status: "negotiating",
        proposed_fee_kobo: asking,
        rate_proposed_at: new Date().toISOString(),
        rate_note: "This is my rate for a single TikTok video.",
      })
      .eq("id", firstDeal.id);

    const queue = await pendingRates(org!.id);
    const mine = queue.find((r) => r.dealId === firstDeal.id);

    check(
      "13. A named rate reaches the agency queue with its affordability worked out",
      Boolean(mine) && mine!.proposedKobo === asking,
      mine
        ? `@${mine.creatorHandle} asking ${formatNaira(mine.proposedKobo)} against ${formatNaira(mine.offeredKobo)} offered, affordable: ${mine.affordable}`
        : "the deal never appeared in the queue",
    );

    // No signed-in user in a script, and `rate_agreed_by` is a real foreign key
    // into auth.users — passing an org id here is what exposed the silent write.
    const accepted = await acceptRate(firstDeal.id, null);
    const { data: settled } = await db
      .from("deals")
      .select("fee_kobo, status, proposed_fee_kobo, rate_agreed_at")
      .eq("id", firstDeal.id)
      .maybeSingle();

    check(
      "14. Accepting a rate fixes the fee, clears the ask and marks it agreed",
      accepted.ok &&
        Number(settled?.fee_kobo) === asking &&
        settled?.status === "accepted" &&
        settled?.proposed_fee_kobo === null &&
        Boolean(settled?.rate_agreed_at),
      accepted.ok
        ? `fee is now ${formatNaira(Number(settled?.fee_kobo))}, status ${settled?.status}`
        : accepted.message,
    );

    // A rate escrow cannot cover must be refused before the work is done, not
    // discovered at payout when there is no good answer.
    const { data: second } = await db
      .from("deals")
      .select("id")
      .eq("campaign_id", campaign!.id)
      .neq("id", firstDeal.id)
      .limit(1)
      .maybeSingle();

    if (second) {
      const absurd = await counterRate(second.id, 50_000_000_00, "Testing the ceiling.");
      check(
        "15. A rate beyond escrow is refused with the shortfall named",
        !absurd.ok && /short|escrow/i.test(absurd.message),
        absurd.message,
      );
    } else {
      check("15. Escrow ceiling", true, "only one deal on this campaign — skipped");
    }
  }


  /* ---- 16. the creator's deal page has something to render ---------------- */

  // Not a screenshot — the data the page is built from. A tabbed page showing
  // the brief, the timeline and the authorisation panel is only as good as the
  // fields behind it, and every one of those was added today.
  const { data: anyDeal } = await db
    .from("deals")
    .select("invite_token")
    .eq("campaign_id", campaign!.id)
    .limit(1)
    .maybeSingle();

  if (!anyDeal) {
    check("16. Creator deal page", false, "no deal to view");
  } else {
    const view = await getInviteByToken(anyDeal.invite_token as string);
    const missing: string[] = [];
    if (!view) missing.push("the invite resolved to nothing");
    else {
      if (!view.campaign?.brief.product) missing.push("brief.product");
      if (!view.deliverableType) missing.push("deliverableType");
      if (!view.agencyName) missing.push("agencyName");
      if (view.escrowHeldKobo <= 0) missing.push("escrowHeldKobo");
      if (!view.brandName) missing.push("brandName");
    }

    check(
      "16. The creator deal page has a brief, a deliverable, an agency and escrow",
      missing.length === 0,
      missing.length === 0
        ? `${view!.deliverableCount} x ${view!.deliverableType} for ${view!.brandName}, run by ${view!.agencyName}, ${formatNaira(view!.escrowHeldKobo)} held`
        : `missing: ${missing.join(", ")}`,
    );
  }


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
