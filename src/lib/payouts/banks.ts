import "server-only";

import { env, integrations } from "@/lib/env";

// Re-exported so server callers have one import for everything bank-related.
export {
  formatNigerianPhone,
  maskAccountNumber,
  normaliseNigerianPhone,
} from "./format";

/**
 * Bank account verification.
 *
 * Mistyping your own account number is the most common way a payout fails, and
 * it fails *after* the work is done. So the number is resolved to a name before
 * it is saved, and the creator confirms the name they are shown — which also
 * catches the case where somebody has been given an account that is not theirs.
 *
 * Without Paystack configured this returns an explicitly unverified result
 * rather than a plausible-looking name, so nothing pretends a check happened.
 */

export interface Bank {
  name: string;
  code: string;
}

/**
 * The banks this audience is actually paid into, most common first. Opay and
 * PalmPay lead rather than the tier-one banks because that is where creators in
 * the 5k–200k tier keep money.
 */
export const COMMON_BANKS: Bank[] = [
  { name: "Opay", code: "999992" },
  { name: "PalmPay", code: "999991" },
  { name: "Kuda Bank", code: "50211" },
  { name: "Moniepoint MFB", code: "50515" },
  { name: "Access Bank", code: "044" },
  { name: "Guaranty Trust Bank", code: "058" },
  { name: "United Bank for Africa", code: "033" },
  { name: "Zenith Bank", code: "057" },
  { name: "First Bank of Nigeria", code: "011" },
  { name: "Fidelity Bank", code: "070" },
  { name: "Union Bank of Nigeria", code: "032" },
  { name: "Sterling Bank", code: "232" },
  { name: "Stanbic IBTC Bank", code: "221" },
  { name: "Wema Bank", code: "035" },
  { name: "Polaris Bank", code: "076" },
  { name: "Ecobank Nigeria", code: "050" },
  { name: "Keystone Bank", code: "082" },
  { name: "Providus Bank", code: "101" },
];

export async function listBanks(): Promise<Bank[]> {
  if (!integrations.paystack) return COMMON_BANKS;

  try {
    const response = await fetch(
      "https://api.paystack.co/bank?country=nigeria&perPage=100",
      {
        headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}` },
        // The list changes rarely; a day of caching saves a call per page view.
        next: { revalidate: 86_400 },
      },
    );
    const json = (await response.json()) as {
      status: boolean;
      data?: { name: string; code: string }[];
    };
    if (!json.status || !json.data?.length) return COMMON_BANKS;

    // Keep the common ones pinned to the top; nobody should scroll past forty
    // microfinance banks to find Opay.
    const pinned = new Set(COMMON_BANKS.map((b) => b.code));
    const rest = json.data
      .filter((b) => !pinned.has(b.code))
      .map((b) => ({ name: b.name, code: b.code }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return [...COMMON_BANKS, ...rest];
  } catch {
    return COMMON_BANKS;
  }
}

export type ResolveResult =
  | { ok: true; accountName: string; verified: boolean }
  | { ok: false; error: string };

/**
 * Turns an account number into the name on the account.
 *
 * `verified: false` means the name did not come from a bank, so the caller can
 * say so plainly instead of implying a check that never ran.
 */
export async function resolveAccount(
  accountNumber: string,
  bankCode: string,
): Promise<ResolveResult> {
  const digits = accountNumber.replace(/\D/g, "");
  if (digits.length !== 10) {
    return { ok: false, error: "A Nigerian account number is 10 digits." };
  }
  if (!bankCode) {
    return { ok: false, error: "Choose your bank first." };
  }

  if (!integrations.paystack) {
    return {
      ok: true,
      accountName: "Not checked — bank verification is not switched on yet",
      verified: false,
    };
  }

  try {
    const response = await fetch(
      `https://api.paystack.co/bank/resolve?account_number=${digits}&bank_code=${bankCode}`,
      { headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}` } },
    );
    const json = (await response.json()) as {
      status: boolean;
      data?: { account_name: string };
    };

    if (!json.status || !json.data?.account_name) {
      return {
        ok: false,
        error:
          "We could not find that account. Check the number, and that the bank is right.",
      };
    }

    return { ok: true, accountName: json.data.account_name, verified: true };
  } catch {
    return {
      ok: false,
      error: "We could not reach your bank just now. Try again in a moment.",
    };
  }
}
