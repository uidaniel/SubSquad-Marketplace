/**
 * Proves the ledger's core invariant against the real database.
 *
 * The unit tests cover the builders; this covers the thing the builders cannot
 * enforce on their own — that Postgres itself refuses to store a transaction
 * that does not balance, no matter which code path tries to write it.
 *
 *   npx tsx scripts/verify-ledger.mts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// Read .env.local directly: this is a script, not part of the Next runtime.
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

const db = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
};

async function main() {
  console.log("\nVerifying the ledger against the live database\n");

  // --- a place to put the test accounts ------------------------------------
  const { data: org, error: orgError } = await db
    .from("orgs")
    .insert({ type: "agency", name: "__ledger_verification__", country: "NG" })
    .select()
    .single();
  if (orgError) throw orgError;

  const { data: space } = await db
    .from("spaces")
    .insert({ org_id: org.id, name: "__verify__" })
    .select()
    .single();

  const { data: accounts, error: accountsError } = await db
    .from("ledger_accounts")
    .insert([
      { kind: "space_wallet", org_id: org.id, space_id: space!.id },
      { kind: "campaign_escrow", org_id: org.id, space_id: space!.id },
    ])
    .select();
  if (accountsError) throw accountsError;
  const [wallet, escrow] = accounts!;

  // --- 1. a balanced transaction is accepted -------------------------------
  const { data: goodTx } = await db
    .from("ledger_transactions")
    .insert({ type: "lock", memo: "verification: balanced" })
    .select()
    .single();

  const { error: goodError } = await db.from("ledger_entries").insert([
    { transaction_id: goodTx!.id, account_id: wallet.id, amount_kobo: -500_000 },
    { transaction_id: goodTx!.id, account_id: escrow.id, amount_kobo: 500_000 },
  ]);
  check("a balanced transaction is accepted", !goodError, goodError?.message);

  // --- 2. an unbalanced transaction is refused -----------------------------
  const { data: badTx } = await db
    .from("ledger_transactions")
    .insert({ type: "lock", memo: "verification: unbalanced" })
    .select()
    .single();

  const { error: badError } = await db.from("ledger_entries").insert([
    { transaction_id: badTx!.id, account_id: wallet.id, amount_kobo: -500_000 },
    { transaction_id: badTx!.id, account_id: escrow.id, amount_kobo: 400_000 },
  ]);
  check(
    "an unbalanced transaction is refused by the database",
    Boolean(badError) && /does not balance/.test(badError?.message ?? ""),
    badError ? badError.message.split("\n")[0] : "it was accepted, which is a bug",
  );

  // --- 3. a one-sided transaction is refused -------------------------------
  const { data: loneTx } = await db
    .from("ledger_transactions")
    .insert({ type: "deposit", memo: "verification: one-sided" })
    .select()
    .single();

  const { error: loneError } = await db
    .from("ledger_entries")
    .insert([{ transaction_id: loneTx!.id, account_id: wallet.id, amount_kobo: 900 }]);
  check(
    "a one-sided transaction is refused",
    Boolean(loneError),
    loneError ? loneError.message.split("\n")[0] : "it was accepted, which is a bug",
  );

  // --- 4. a zero-amount entry is refused -----------------------------------
  const { data: zeroTx } = await db
    .from("ledger_transactions")
    .insert({ type: "deposit", memo: "verification: zero" })
    .select()
    .single();

  const { error: zeroError } = await db.from("ledger_entries").insert([
    { transaction_id: zeroTx!.id, account_id: wallet.id, amount_kobo: 0 },
    { transaction_id: zeroTx!.id, account_id: escrow.id, amount_kobo: 0 },
  ]);
  check("an entry recording no movement is refused", Boolean(zeroError));

  // --- 5. balances are the sum of entries ----------------------------------
  const { data: balances } = await db
    .from("v_balances")
    .select("account_id,balance_kobo")
    .in("account_id", [wallet.id, escrow.id]);

  const byId = new Map(balances?.map((b) => [b.account_id, Number(b.balance_kobo)]));
  check(
    "the wallet balance reflects only the accepted transaction",
    byId.get(wallet.id) === -500_000,
    `got ${byId.get(wallet.id)}`,
  );
  check(
    "the escrow balance reflects only the accepted transaction",
    byId.get(escrow.id) === 500_000,
    `got ${byId.get(escrow.id)}`,
  );

  // --- 6. an account holding money cannot be deleted out from under it ------
  const { error: deleteError } = await db
    .from("ledger_accounts")
    .delete()
    .eq("id", wallet.id);
  check(
    "an account with history cannot be deleted",
    Boolean(deleteError),
    deleteError ? "restricted, as intended" : "it was deleted, which loses history",
  );

  // --- clean up ------------------------------------------------------------
  await db.from("ledger_entries").delete().eq("transaction_id", goodTx!.id);
  await db
    .from("ledger_transactions")
    .delete()
    .in("id", [goodTx!.id, badTx!.id, loneTx!.id, zeroTx!.id]);
  await db.from("ledger_accounts").delete().in("id", [wallet.id, escrow.id]);
  await db.from("spaces").delete().eq("id", space!.id);
  await db.from("orgs").delete().eq("id", org.id);

  console.log(
    failures === 0
      ? "\nThe ledger holds. Postgres refuses to store money that does not add up.\n"
      : `\n${failures} check(s) failed.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("\nVerification could not run:", error.message ?? error);
  process.exit(1);
});
