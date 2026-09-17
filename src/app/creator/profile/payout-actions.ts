"use server";

import { revalidatePath } from "next/cache";
import { requireServiceClient } from "@/lib/supabase/service";
import { getCurrentCreator } from "@/lib/data/creator-queries";
import { resolveAccount } from "@/lib/payouts/banks";

/**
 * A signed-in creator setting up where they get paid.
 *
 * The onboarding flow already does this against an invite token; this is the
 * same thing for a creator who is already in, reached from their profile. The
 * profile showed a hardcoded "GTBank ••••6789" and offered no way to set or
 * change the real one, so a creator who onboarded without a bank account — or
 * whose account changed — could never be paid.
 *
 * The name is always resolved with the bank before saving. We never store an
 * account we have not checked the name on, because a transfer to the wrong
 * account number cannot be pulled back.
 */

export type LookUpResult =
  | { ok: true; accountName: string; verified: boolean }
  | { ok: false; error: string };

export async function lookUpMyAccount(
  bankCode: string,
  accountNumber: string,
): Promise<LookUpResult> {
  const creator = await getCurrentCreator();
  if (!creator) return { ok: false, error: "Sign in again to do this." };

  const result = await resolveAccount(accountNumber, bankCode);
  if (!result.ok) return { ok: false, error: result.error };

  return {
    ok: true,
    accountName: result.accountName,
    verified: result.verified,
  };
}

export type SaveResult = { ok: true; message: string } | { ok: false; error: string };

export async function saveMyPayoutAccount(input: {
  bankCode: string;
  accountNumber: string;
}): Promise<SaveResult> {
  const creator = await getCurrentCreator();
  if (!creator) return { ok: false, error: "Sign in again to do this." };

  const digits = input.accountNumber.replace(/\D/g, "");

  // Re-resolved here rather than trusting the name the browser sends back: the
  // client could send any name alongside any account number.
  const resolved = await resolveAccount(digits, input.bankCode);
  if (!resolved.ok) return { ok: false, error: resolved.error };

  const db = requireServiceClient();
  const { error } = await db
    .from("creators")
    .update({
      payout_bank_code: input.bankCode,
      payout_account_number: digits,
      payout_account_name: resolved.accountName,
      payout_verified: resolved.verified,
    })
    .eq("id", creator.id);

  if (error) {
    return { ok: false, error: `Could not save that: ${error.message}` };
  }

  revalidatePath("/creator/profile");
  revalidatePath("/creator/wallet");

  return {
    ok: resolved.verified,
    message: resolved.verified
      ? `Saved. Payouts will go to ${resolved.accountName}.`
      : `Saved, but we could not confirm the name with your bank yet. You will not be able to withdraw until we can.`,
  } as SaveResult;
}
