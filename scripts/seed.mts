/**
 * Seeds the Supabase project with the demo dataset.
 *
 *   npx tsx scripts/seed.mts
 *
 * Idempotent: every row's id is derived deterministically from its demo id, so
 * running this twice updates rather than duplicates. That matters because this
 * is also how a pilot environment is reset between demos.
 *
 * The ledger is not seeded with literal balances. The same builders the product
 * uses in production produce the transactions, and Postgres enforces that they
 * balance — so a seeded database is proof the money rules work, not a fixture
 * that merely looks like it.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  DEMO_CAMPAIGNS,
  DEMO_CREATORS,
  DEMO_DEALS,
  DEMO_DRAFTS,
  DEMO_MESSAGES,
  DEMO_MEMBERS,
  DEMO_ORG,
  DEMO_PROFILES,
  DEMO_SCORES,
  DEMO_SHORTLIST,
  DEMO_SLOTS,
  DEMO_SPACES,
  DEMO_TRANSACTIONS,
  DEMO_ACCOUNTS,
} from "../src/lib/demo/data.ts";

const envFile = readFileSync(".env.local", "utf8");
const env = Object.fromEntries(
  envFile
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    }),
);

const db: SupabaseClient = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

/** A stable UUID for a demo id, so re-seeding updates the same rows. */
function uuidFor(key: string): string {
  const hash = createHash("sha1").update(`subsquad:${key}`).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const step = (label: string) => process.stdout.write(`  ${label.padEnd(40)}`);
const done = (n: number | string = "ok") => console.log(String(n));

async function upsert(table: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return 0;
  const { error } = await db.from(table).upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`${table}: ${error.message}`);
  return rows.length;
}

async function main() {
  console.log("\nSeeding SubSquad\n");

  /* ---- people who can sign in -------------------------------------------- */
  step("auth users");
  const userIds = new Map<string, string>();
  for (const member of DEMO_MEMBERS) {
    const email = member.email;
    const { data: existing } = await db.auth.admin.listUsers({ perPage: 200 });
    const found = existing?.users.find((u) => u.email === email);
    if (found) {
      userIds.set(member.userId, found.id);
      continue;
    }
    const { data, error } = await db.auth.admin.createUser({
      email,
      password: "subsquad-demo",
      email_confirm: true,
      user_metadata: { name: member.name },
    });
    if (error) throw new Error(`auth ${email}: ${error.message}`);
    userIds.set(member.userId, data.user!.id);
  }
  done(userIds.size);

  /* ---- accounts ---------------------------------------------------------- */
  step("orgs");
  done(
    await upsert("orgs", [
      {
        id: uuidFor(DEMO_ORG.id),
        type: DEMO_ORG.type,
        name: DEMO_ORG.name,
        cac_number: DEMO_ORG.cacNumber,
        country: DEMO_ORG.country,
        verification_status: DEMO_ORG.verificationStatus,
        verified_at: DEMO_ORG.verifiedAt,
        default_margin_bps: DEMO_ORG.defaultMarginBps,
      },
    ]),
  );

  step("org members");
  done(
    await upsert(
      "org_members",
      DEMO_MEMBERS.filter((m) => m.orgId === DEMO_ORG.id).map((m) => ({
        id: uuidFor(m.id),
        org_id: uuidFor(m.orgId),
        user_id: userIds.get(m.userId),
        role: m.role,
      })),
    ),
  );

  step("spaces");
  const spaces = DEMO_SPACES.filter((s) => s.orgId === DEMO_ORG.id);
  done(
    await upsert(
      "spaces",
      spaces.map((s) => ({
        id: uuidFor(s.id),
        org_id: uuidFor(s.orgId),
        name: s.name,
        category: s.category,
        is_self: s.isSelf,
      })),
    ),
  );

  /* ---- creators ---------------------------------------------------------- */
  step("creators");
  done(
    await upsert(
      "creators",
      DEMO_CREATORS.map((c) => ({
        id: uuidFor(c.id),
        display_name: c.displayName,
        primary_platform: c.primaryPlatform,
        handle: c.handle,
        phone: c.phone,
        email: c.email,
        whatsapp_opt_in: c.whatsappOptIn,
        status: c.status,
        payout_bank_code: c.payoutBankCode,
        payout_account_number: c.payoutAccountNumber,
        payout_account_name: c.payoutAccountName,
        payout_verified: c.payoutVerified,
        contact_source: c.contactSource,
        do_not_contact: c.doNotContact,
        last_contacted_at: c.lastContactedAt,
      })),
    ),
  );

  step("creator profiles");
  done(
    await upsert(
      "creator_profiles",
      DEMO_PROFILES.map((p) => ({
        id: uuidFor(p.id),
        creator_id: uuidFor(p.creatorId),
        platform: p.platform,
        followers: p.followers,
        following: p.following,
        posts_count: p.postsCount,
        avg_views: p.avgViews,
        avg_likes: p.avgLikes,
        avg_comments: p.avgComments,
        engagement_rate: p.engagementRate,
        category_tags: p.categoryTags,
        languages: p.languages,
        location_city: p.locationCity,
        sample_posts: p.samplePosts,
        fetched_at: p.fetchedAt,
      })),
    ),
  );

  step("creator scores");
  done(
    await upsert(
      "creator_scores",
      DEMO_SCORES.map((s) => ({
        id: uuidFor(s.id),
        creator_id: uuidFor(s.creatorId),
        campaign_id: null,
        fraud_score: s.fraudScore,
        reasons: s.reasons,
        computed_at: s.computedAt,
      })),
    ),
  );

  /* ---- campaigns --------------------------------------------------------- */
  step("campaigns");
  done(
    await upsert(
      "campaigns",
      DEMO_CAMPAIGNS.map((c) => ({
        id: uuidFor(c.id),
        org_id: uuidFor(c.orgId),
        space_id: uuidFor(c.spaceId),
        name: c.name,
        end_brand_name: c.endBrandName,
        status: c.status,
        budget_kobo: c.budgetKobo,
        platform_fee_bps: c.platformFeeBps,
        agency_margin_bps: c.agencyMarginBps,
        arcon_category: c.arconCategory,
        brief: c.brief,
        rate_band_min_kobo: c.rateBandMinKobo,
        rate_band_max_kobo: c.rateBandMaxKobo,
        deadline: c.deadline,
        created_at: c.createdAt,
      })),
    ),
  );

  step("campaign slots");
  done(
    await upsert(
      "campaign_slots",
      DEMO_SLOTS.map((s) => ({
        id: uuidFor(s.id),
        campaign_id: uuidFor(s.campaignId),
        deliverable_type: s.deliverableType,
        count: s.count,
        fee_kobo: s.feeKobo,
      })),
    ),
  );

  step("shortlist");
  done(
    await upsert(
      "shortlist_items",
      DEMO_SHORTLIST.map((s) => ({
        id: uuidFor(s.id),
        campaign_id: uuidFor(s.campaignId),
        creator_id: uuidFor(s.creatorId),
        slot_id: s.slotId ? uuidFor(s.slotId) : null,
        ai_reasoning: s.aiReasoning,
        fit_score: s.fitScore,
        estimated_fee_kobo: s.estimatedFeeKobo,
        status: s.status,
      })),
    ),
  );

  /* ---- deals ------------------------------------------------------------- */
  step("deals");
  done(
    await upsert(
      "deals",
      DEMO_DEALS.map((d) => ({
        id: uuidFor(d.id),
        campaign_id: d.campaignId ? uuidFor(d.campaignId) : null,
        creator_id: uuidFor(d.creatorId),
        slot_id: d.slotId ? uuidFor(d.slotId) : null,
        origin: d.origin,
        fee_kobo: d.feeKobo,
        platform_fee_bps: d.platformFeeBps,
        fee_paid_by: d.feePaidBy,
        status: d.status,
        deadline: d.deadline,
        invite_token: d.inviteToken,
        contract_pdf_url: d.contractPdfUrl,
        contract_accepted_at: d.contractAcceptedAt,
        published_url: d.publishedUrl,
        published_at: d.publishedAt,
        created_at: d.createdAt,
      })),
    ),
  );

  step("messages");
  done(
    await upsert(
      "deal_messages",
      DEMO_MESSAGES.map((m) => ({
        id: uuidFor(m.id),
        deal_id: uuidFor(m.dealId),
        direction: m.direction,
        channel: m.channel,
        body: m.body,
        ai_draft: m.aiDraft,
        approved_by: m.approvedBy ? userIds.get("user_ada") : null,
        sent_at: m.sentAt,
        created_at: m.createdAt,
      })),
    ),
  );

  step("drafts");
  done(
    await upsert(
      "drafts",
      DEMO_DRAFTS.map((d) => ({
        id: uuidFor(d.id),
        deal_id: uuidFor(d.dealId),
        version: d.version,
        file_url: d.fileUrl,
        caption: d.caption,
        submitted_at: d.submittedAt,
        ai_review: d.aiReview,
        reviewer_decision: d.reviewerDecision,
        reviewer_notes: d.reviewerNotes,
      })),
    ),
  );

  /* ---- money ------------------------------------------------------------- */
  step("ledger accounts");
  done(
    await upsert(
      "ledger_accounts",
      DEMO_ACCOUNTS.map((a) => ({
        id: uuidFor(a.id),
        kind: a.kind,
        org_id: a.orgId ? uuidFor(a.orgId) : null,
        space_id: a.spaceId ? uuidFor(a.spaceId) : null,
        creator_id: a.creatorId ? uuidFor(a.creatorId) : null,
        campaign_id: a.campaignId ? uuidFor(a.campaignId) : null,
        deal_id: a.dealId ? uuidFor(a.dealId) : null,
        currency: a.currency,
      })),
    ),
  );

  // Transactions are replaced wholesale rather than upserted: a ledger is
  // append-only in production, and the only safe way to re-seed one is to clear
  // the seeded rows first so no partial transaction is ever left behind.
  step("ledger transactions");
  const txIds = DEMO_TRANSACTIONS.map((t) => uuidFor(t.id));
  await db.from("ledger_entries").delete().in("transaction_id", txIds);
  await db.from("ledger_transactions").delete().in("id", txIds);

  await upsert(
    "ledger_transactions",
    DEMO_TRANSACTIONS.map((t) => ({
      id: uuidFor(t.id),
      type: t.type,
      reference: t.reference,
      memo: t.memo,
      created_by: t.createdBy ? userIds.get("user_ada") : null,
      created_at: t.createdAt,
    })),
  );

  // Each transaction's entries go in one request, so the deferred zero-sum
  // trigger sees the whole transaction and validates it as a unit.
  let entryCount = 0;
  for (const tx of DEMO_TRANSACTIONS) {
    const { error } = await db.from("ledger_entries").insert(
      tx.entries.map((e) => ({
        id: randomUUID(),
        transaction_id: uuidFor(tx.id),
        account_id: uuidFor(e.accountId),
        amount_kobo: e.amountKobo,
        created_at: tx.createdAt,
      })),
    );
    if (error) throw new Error(`entries for ${tx.memo}: ${error.message}`);
    entryCount += tx.entries.length;
  }
  done(`${DEMO_TRANSACTIONS.length} transactions, ${entryCount} entries`);

  /* ---- prove it ---------------------------------------------------------- */
  const { data: balances } = await db
    .from("v_balances")
    .select("kind,balance_kobo")
    .neq("entry_count", 0);

  const total = (balances ?? []).reduce(
    (sum, row) => sum + Number(row.balance_kobo),
    0,
  );

  console.log("\n  Balances now in Postgres:");
  for (const row of balances ?? []) {
    console.log(
      `    ${String(row.kind).padEnd(20)} ${(Number(row.balance_kobo) / 100).toLocaleString("en-NG", { style: "currency", currency: "NGN" })}`,
    );
  }
  console.log(
    `\n  Every account summed: ${total} — ${total === 0 ? "the books balance." : "THESE DO NOT BALANCE."}\n`,
  );

  console.log("  Sign in as ada@kongadigital.ng / subsquad-demo\n");
  process.exit(total === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("\nSeed failed:", error.message ?? error);
  process.exit(1);
});
