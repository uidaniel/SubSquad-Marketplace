"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireServiceClient } from "@/lib/supabase/service";
import { env } from "@/lib/env";
import { sendVerificationCode, verifyCode } from "@/lib/auth/otp";
import {
  normaliseNigerianPhone,
  resolveAccount,
} from "@/lib/payouts/banks";

/**
 * Everything a creator does while holding an invite token and nothing else.
 *
 * The token is the authorisation here — it was sent to one person's WhatsApp
 * and is unguessable — so these run through the service client. Each action
 * therefore re-reads the deal by token and refuses to act on one that is not in
 * a state where the action makes sense: a token that leaks must not be able to
 * accept a deal twice, or accept one that was already declined.
 */

export type ActionResult = { error: string } | { ok: true } | undefined;

/** Deal states from which a creator can still take the work. */
const ACCEPTABLE = new Set(["invited", "negotiating"]);

async function dealByToken(token: string) {
  const db = requireServiceClient();
  const { data } = await db
    .from("deals")
    .select("*, creators(*)")
    .eq("invite_token", token)
    .maybeSingle();
  return data;
}

/** The IP a contract was accepted from, for the audit trail. */
async function clientIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
}

function demoGuard(): ActionResult {
  if (env.demoMode) {
    return {
      error:
        "This is the demo. Connect a Supabase project to accept a real deal.",
    };
  }
  return undefined;
}

/* ==========================================================================
   Accepting the work
   ========================================================================== */

export async function acceptInvite(token: string): Promise<ActionResult> {
  const blocked = demoGuard();
  if (blocked) return blocked;

  const deal = await dealByToken(token);
  if (!deal) return { error: "We could not find that invite." };

  if (!ACCEPTABLE.has(deal.status)) {
    // Already accepted is not an error worth blocking on — send them onward.
    if (deal.status === "accepted" || deal.status === "contract_signed") {
      redirect(`/i/${token}/onboarding`);
    }
    return {
      error: "This deal is no longer open. Reply on WhatsApp and we will help.",
    };
  }

  const db = requireServiceClient();
  await db.from("deals").update({ status: "accepted" }).eq("id", deal.id);

  revalidatePath(`/i/${token}`);
  redirect(`/i/${token}/onboarding`);
}

export async function declineInvite(
  token: string,
  reason?: string,
): Promise<ActionResult> {
  const blocked = demoGuard();
  if (blocked) return blocked;

  const deal = await dealByToken(token);
  if (!deal) return { error: "We could not find that invite." };
  if (!ACCEPTABLE.has(deal.status)) {
    return { error: "This deal is no longer open." };
  }

  const db = requireServiceClient();
  await db.from("deals").update({ status: "declined" }).eq("id", deal.id);

  // Recorded as an inbound message so the agency sees why, in the same thread
  // as everything else rather than as a status change with no explanation.
  if (reason?.trim()) {
    await db.from("deal_messages").insert({
      deal_id: deal.id,
      direction: "inbound",
      channel: "manual",
      body: `Declined: ${reason.trim()}`,
      ai_draft: false,
    });
  }

  revalidatePath(`/i/${token}`);
  return { ok: true };
}

/* ==========================================================================
   Step one — the phone
   ========================================================================== */

export type CodeResult =
  | { ok: true; phone: string; dryRun: boolean; devCode?: string }
  | { error: string };

export async function requestCode(
  _prev: CodeResult | undefined,
  formData: FormData,
): Promise<CodeResult> {
  if (env.demoMode) {
    return { error: "Connect a Supabase project to verify a real number." };
  }

  const raw = String(formData.get("phone") ?? "");
  const phone = normaliseNigerianPhone(raw);
  if (!phone) {
    return {
      error: "That does not look like a Nigerian number. Try 0803 000 4471.",
    };
  }

  const token = String(formData.get("token") ?? "");
  const deal = await dealByToken(token);
  if (!deal) return { error: "We could not find that invite." };

  const sent = await sendVerificationCode(phone);
  if (!sent.ok) return { error: sent.error };

  return {
    ok: true,
    phone,
    dryRun: sent.dryRun,
    devCode: sent.devCode,
  };
}

export async function confirmCode(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const blocked = demoGuard();
  if (blocked) return blocked;

  const token = String(formData.get("token") ?? "");
  const phone = String(formData.get("phone") ?? "");
  const code = String(formData.get("code") ?? "");

  const deal = await dealByToken(token);
  if (!deal) return { error: "We could not find that invite." };

  const result = await verifyCode(phone, code);
  if (!result.ok) return { error: result.error };

  const db = requireServiceClient();
  await db
    .from("creators")
    .update({
      phone,
      phone_verified_at: new Date().toISOString(),
      // Verifying a number over WhatsApp is consent to be reached there.
      whatsapp_opt_in: true,
    })
    .eq("id", deal.creator_id);

  revalidatePath(`/i/${token}/onboarding`);
  return { ok: true };
}

/* ==========================================================================
   Step two — where the money goes
   ========================================================================== */

export type ResolveState =
  | { ok: true; accountName: string; verified: boolean; bankCode: string; accountNumber: string }
  | { error: string }
  | undefined;

/** Looks up the name on an account so the creator can confirm it is theirs. */
export async function lookUpAccount(
  _prev: ResolveState,
  formData: FormData,
): Promise<ResolveState> {
  const bankCode = String(formData.get("bankCode") ?? "");
  const accountNumber = String(formData.get("accountNumber") ?? "");

  const result = await resolveAccount(accountNumber, bankCode);
  if (!result.ok) return { error: result.error };

  return {
    ok: true,
    accountName: result.accountName,
    verified: result.verified,
    bankCode,
    accountNumber: accountNumber.replace(/\D/g, ""),
  };
}

export async function savePayoutAccount(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const blocked = demoGuard();
  if (blocked) return blocked;

  const token = String(formData.get("token") ?? "");
  const bankCode = String(formData.get("bankCode") ?? "");
  const accountNumber = String(formData.get("accountNumber") ?? "").replace(/\D/g, "");
  const accountName = String(formData.get("accountName") ?? "");
  const verified = String(formData.get("verified") ?? "") === "true";

  if (!bankCode || accountNumber.length !== 10 || !accountName) {
    return { error: "Check your bank and account number, then confirm the name." };
  }

  const deal = await dealByToken(token);
  if (!deal) return { error: "We could not find that invite." };

  const db = requireServiceClient();
  await db
    .from("creators")
    .update({
      payout_bank_code: bankCode,
      payout_account_number: accountNumber,
      payout_account_name: accountName,
      payout_verified: verified,
    })
    .eq("id", deal.creator_id);

  revalidatePath(`/i/${token}/onboarding`);
  return { ok: true };
}

/* ==========================================================================
   Step three — the contract
   ========================================================================== */

export async function acceptContract(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const blocked = demoGuard();
  if (blocked) return blocked;

  const token = String(formData.get("token") ?? "");
  if (String(formData.get("agreed") ?? "") !== "on") {
    return { error: "Tick the box to accept the contract." };
  }

  const deal = await dealByToken(token);
  if (!deal) return { error: "We could not find that invite." };

  const creator = deal.creators as Record<string, unknown> | null;
  // The three facts have to be true before a contract means anything: we know
  // who they are, where to pay them, and that they agreed.
  if (!creator?.phone_verified_at) {
    return { error: "Verify your WhatsApp number first." };
  }
  if (!creator?.payout_account_number) {
    return { error: "Add the account you want to be paid into first." };
  }

  const db = requireServiceClient();
  const now = new Date().toISOString();
  const ip = await clientIp();

  await db
    .from("creators")
    .update({
      terms_accepted_at: now,
      terms_accepted_ip: ip,
      onboarded_at: now,
      status: "onboarded",
    })
    .eq("id", deal.creator_id);

  await db
    .from("deals")
    .update({
      status: "contract_signed",
      contract_accepted_at: now,
      contract_ip: ip,
    })
    .eq("id", deal.id);

  revalidatePath(`/i/${token}/onboarding`);
  redirect(`/i/${token}/onboarding?done=1`);
}

/* ==========================================================================
   Countering
   ========================================================================== */

/**
 * A creator asking for more.
 *
 * This records the counter and moves the deal to negotiating — it does not
 * change the fee. A number only becomes an offer when a person at the agency
 * approves it, which is the same rule that governs everything else the platform
 * sends on their behalf.
 *
 * Landing it as an inbound message rather than a status change means the agency
 * sees the ask in the same thread as the rest of the conversation, with the
 * creator's own words attached.
 */
export async function counterOffer(
  token: string,
  amountKobo: number,
  note?: string,
): Promise<ActionResult> {
  const blocked = demoGuard();
  if (blocked) return blocked;

  const deal = await dealByToken(token);
  if (!deal) return { error: "We could not find that invite." };
  if (!ACCEPTABLE.has(deal.status)) {
    return { error: "This deal is no longer open." };
  }
  if (!Number.isInteger(amountKobo) || amountKobo <= Number(deal.fee_kobo)) {
    return { error: "Ask for more than what is already offered." };
  }

  const db = requireServiceClient();
  const naira = (amountKobo / 100).toLocaleString("en-NG");

  await db.from("deal_messages").insert({
    deal_id: deal.id,
    direction: "inbound",
    channel: "manual",
    body: note?.trim()
      ? `Counter-offer: ₦${naira}. ${note.trim()}`
      : `Counter-offer: ₦${naira}.`,
    ai_draft: false,
  });

  await db.from("deals").update({ status: "negotiating" }).eq("id", deal.id);

  revalidatePath(`/i/${token}`);
  return { ok: true };
}
