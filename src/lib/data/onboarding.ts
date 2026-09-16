import "server-only";

import { env } from "@/lib/env";
import { requireServiceClient } from "@/lib/supabase/service";
import { getInviteByToken } from "@/lib/data/creator-queries";

/**
 * How far through onboarding a creator is.
 *
 * Derived from the record rather than held in a session, so the flow survives
 * what actually happens: the tab closed on a phone with 3% battery, the link
 * reopened two days later, the same creator accepting a second deal and
 * expecting not to be asked for their bank details again.
 */

export type OnboardingStep = "phone" | "payout" | "contract" | "done";

export interface OnboardingState {
  token: string;
  dealId: string;
  creatorId: string;
  creatorName: string;
  /** What we already hold for them, so a returning creator confirms rather than retypes. */
  phone: string | null;
  phoneVerified: boolean;
  payoutBankCode: string | null;
  payoutAccountNumber: string | null;
  payoutAccountName: string | null;
  payoutVerified: boolean;
  contractAccepted: boolean;
  feeKobo: number;
  deadline: string;
  brandName: string;
  campaignName: string | null;
  step: OnboardingStep;
}

function stepFor(s: {
  phoneVerified: boolean;
  payoutAccountNumber: string | null;
  contractAccepted: boolean;
}): OnboardingStep {
  if (!s.phoneVerified) return "phone";
  if (!s.payoutAccountNumber) return "payout";
  if (!s.contractAccepted) return "contract";
  return "done";
}

export async function getOnboardingState(
  token: string,
): Promise<OnboardingState | null> {
  if (env.demoMode) {
    const invite = await getInviteByToken(token);
    if (!invite) return null;
    const { deal, creator, campaign, brandName } = invite;
    return {
      token,
      dealId: deal.id,
      creatorId: creator.id,
      creatorName: creator.displayName,
      phone: creator.phone,
      // The demo always starts at the beginning — the point is to walk the flow.
      phoneVerified: false,
      payoutBankCode: null,
      payoutAccountNumber: null,
      payoutAccountName: null,
      payoutVerified: false,
      contractAccepted: false,
      feeKobo: deal.feeKobo,
      deadline: deal.deadline,
      brandName,
      campaignName: campaign?.name ?? null,
      step: "phone",
    };
  }

  const db = requireServiceClient();
  const { data: deal } = await db
    .from("deals")
    .select("*, creators(*), campaigns(name, end_brand_name)")
    .eq("invite_token", token)
    .maybeSingle();

  if (!deal) return null;

  const creator = deal.creators as Record<string, unknown>;
  const campaign = deal.campaigns as Record<string, unknown> | null;

  const base = {
    phoneVerified: Boolean(creator.phone_verified_at),
    payoutAccountNumber: (creator.payout_account_number as string) ?? null,
    contractAccepted: Boolean(deal.contract_accepted_at),
  };

  return {
    token,
    dealId: deal.id as string,
    creatorId: deal.creator_id as string,
    creatorName: (creator.display_name as string) ?? "there",
    phone: (creator.phone as string) ?? null,
    payoutBankCode: (creator.payout_bank_code as string) ?? null,
    payoutAccountName: (creator.payout_account_name as string) ?? null,
    payoutVerified: Boolean(creator.payout_verified),
    feeKobo: Number(deal.fee_kobo),
    deadline: deal.deadline as string,
    brandName:
      (campaign?.end_brand_name as string) ?? "the brand",
    campaignName: (campaign?.name as string) ?? null,
    ...base,
    step: stepFor(base),
  };
}
