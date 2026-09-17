import "server-only";

import { requireServiceClient } from "@/lib/supabase/service";
import { accountFor, balanceOf } from "@/lib/ledger/post";
import { one } from "@/lib/data/relations";
import { formatNaira, type Kobo } from "@/lib/money";

/**
 * Settling what a creator is paid.
 *
 * A creator names a rate; somebody on the brand side has to answer. That answer
 * moves money, so it lives here rather than in a server action: the rules about
 * whether escrow can cover a higher fee are the same whoever asks.
 *
 * Three answers, and no fourth. Accept, offer a different number, or decline.
 * "Leave it open" is what was happening before and it is not an answer — the
 * creator is waiting, and a creator who waits takes other work.
 */

export type RateOutcome =
  | { ok: true; message: string }
  | { ok: false; message: string };

export interface PendingRate {
  dealId: string;
  campaignId: string | null;
  campaignName: string;
  creatorId: string;
  creatorName: string;
  creatorHandle: string;
  /** What the campaign originally offered. */
  offeredKobo: Kobo;
  /** What the creator is asking for. */
  proposedKobo: Kobo;
  note: string | null;
  proposedAt: string;
  /** Whether escrow can cover the asking rate today. */
  affordable: boolean;
  shortfallKobo: Kobo;
}

/**
 * What accepting would cost, and whether the campaign can cover it.
 *
 * The platform fee rides on top of the creator's fee, so a rate that looks
 * affordable against the raw escrow balance may not be. Working that out before
 * the button is pressed is the difference between a decision and a failure.
 */
async function affordability(deal: {
  id: string;
  campaign_id: string | null;
  fee_kobo: number;
  platform_fee_bps: number;
  proposed_fee_kobo: number;
}) {
  const db = requireServiceClient();

  if (!deal.campaign_id) {
    // A creator-initiated deal is funded per deal, not from a campaign pot.
    return { affordable: true, shortfallKobo: 0 };
  }

  const escrowId = await accountFor("campaign_escrow", {
    campaignId: deal.campaign_id,
  });
  const held = await balanceOf(escrowId);

  // Everything else already promised on this campaign, at whatever was agreed.
  const { data: siblings } = await db
    .from("deals")
    .select("id, fee_kobo, platform_fee_bps")
    .eq("campaign_id", deal.campaign_id)
    .not("status", "in", "(declined,cancelled)");

  const committed = (siblings ?? [])
    .filter((d) => d.id !== deal.id)
    .reduce((sum, d) => {
      const fee = Number(d.fee_kobo);
      return sum + fee + Math.floor((fee * Number(d.platform_fee_bps)) / 10_000);
    }, 0);

  const thisDeal =
    deal.proposed_fee_kobo +
    Math.floor((deal.proposed_fee_kobo * Number(deal.platform_fee_bps)) / 10_000);

  const shortfall = Math.max(0, committed + thisDeal - held);
  return { affordable: shortfall === 0, shortfallKobo: shortfall };
}

/** Every deal waiting on a decision about money, across this org's campaigns. */
export async function pendingRates(orgId: string): Promise<PendingRate[]> {
  const db = requireServiceClient();

  const { data } = await db
    .from("deals")
    .select(
      "id, campaign_id, fee_kobo, platform_fee_bps, proposed_fee_kobo, rate_note, rate_proposed_at, creators(id, display_name, handle), campaigns(name, org_id)",
    )
    .not("proposed_fee_kobo", "is", null)
    .is("rate_agreed_at", null)
    .order("rate_proposed_at", { ascending: true });

  const rows = (data ?? []).filter((d) => {
    const campaign = one(d.campaigns) as { org_id?: string } | undefined;
    return campaign?.org_id === orgId;
  });

  return Promise.all(
    rows.map(async (d) => {
      const creator = one(d.creators) as
        | { id: string; display_name: string; handle: string }
        | undefined;
      const campaign = one(d.campaigns) as { name?: string } | undefined;
      const money = await affordability({
        id: d.id as string,
        campaign_id: d.campaign_id as string | null,
        fee_kobo: Number(d.fee_kobo),
        platform_fee_bps: Number(d.platform_fee_bps),
        proposed_fee_kobo: Number(d.proposed_fee_kobo),
      });

      return {
        dealId: d.id as string,
        campaignId: d.campaign_id as string | null,
        campaignName: campaign?.name ?? "Direct deal",
        creatorId: creator?.id ?? "",
        creatorName: creator?.display_name ?? "A creator",
        creatorHandle: creator?.handle ?? "",
        offeredKobo: Number(d.fee_kobo),
        proposedKobo: Number(d.proposed_fee_kobo),
        note: (d.rate_note as string | null) ?? null,
        proposedAt: d.rate_proposed_at as string,
        affordable: money.affordable,
        shortfallKobo: money.shortfallKobo,
      };
    }),
  );
}

/**
 * Yes.
 *
 * The asking rate becomes the deal's fee, and the creator is told with the full
 * terms — which is the first time those terms bind anybody, and so the first
 * time it is honest to send them.
 */
export async function acceptRate(
  dealId: string,
  agreedBy: string,
): Promise<RateOutcome> {
  const db = requireServiceClient();

  const { data: deal } = await db
    .from("deals")
    .select(
      "id, campaign_id, fee_kobo, platform_fee_bps, proposed_fee_kobo, status",
    )
    .eq("id", dealId)
    .maybeSingle();

  if (!deal) return { ok: false, message: "That deal no longer exists." };
  if (!deal.proposed_fee_kobo) {
    return { ok: false, message: "There is no rate waiting on this deal." };
  }

  const proposed = Number(deal.proposed_fee_kobo);
  const money = await affordability({
    id: deal.id as string,
    campaign_id: deal.campaign_id as string | null,
    fee_kobo: Number(deal.fee_kobo),
    platform_fee_bps: Number(deal.platform_fee_bps),
    proposed_fee_kobo: proposed,
  });

  // Refused here rather than discovered at payout, when the creator has already
  // done the work and there is no good answer.
  if (!money.affordable) {
    return {
      ok: false,
      message: `Accepting ${formatNaira(proposed)} would leave this campaign ${formatNaira(money.shortfallKobo)} short of what it has promised. Add funds to the campaign first, or offer a different rate.`,
    };
  }

  await db
    .from("deals")
    .update({
      fee_kobo: proposed,
      status: "accepted",
      proposed_fee_kobo: null,
      rate_agreed_at: new Date().toISOString(),
      rate_agreed_by: agreedBy,
    })
    .eq("id", dealId);

  await db.from("deal_messages").insert({
    deal_id: dealId,
    direction: "outbound",
    channel: "manual",
    body: `Rate agreed at ${formatNaira(proposed)}.`,
    ai_draft: false,
  });

  return {
    ok: true,
    message: `Agreed at ${formatNaira(proposed)}. The creator has been sent the terms and can sign now.`,
  };
}

/**
 * A different number.
 *
 * Replaces the offer on the deal and hands the decision back, rather than
 * opening a third state nobody is responsible for. The creator sees a fresh
 * offer and can accept it or ask again.
 */
export async function counterRate(
  dealId: string,
  amountKobo: Kobo,
  note: string,
): Promise<RateOutcome> {
  if (!Number.isInteger(amountKobo) || amountKobo <= 0) {
    return { ok: false, message: "Enter the rate you are offering." };
  }

  const db = requireServiceClient();
  const { data: deal } = await db
    .from("deals")
    .select("id, campaign_id, fee_kobo, platform_fee_bps")
    .eq("id", dealId)
    .maybeSingle();
  if (!deal) return { ok: false, message: "That deal no longer exists." };

  const money = await affordability({
    id: deal.id as string,
    campaign_id: deal.campaign_id as string | null,
    fee_kobo: Number(deal.fee_kobo),
    platform_fee_bps: Number(deal.platform_fee_bps),
    proposed_fee_kobo: amountKobo,
  });

  if (!money.affordable) {
    return {
      ok: false,
      message: `Offering ${formatNaira(amountKobo)} would put this campaign ${formatNaira(money.shortfallKobo)} beyond its escrow. Add funds first.`,
    };
  }

  await db
    .from("deals")
    .update({
      fee_kobo: amountKobo,
      status: "invited",
      proposed_fee_kobo: null,
      rate_note: null,
    })
    .eq("id", dealId);

  await db.from("deal_messages").insert({
    deal_id: dealId,
    direction: "outbound",
    channel: "manual",
    body: note.trim()
      ? `We can offer ${formatNaira(amountKobo)}. ${note.trim()}`
      : `We can offer ${formatNaira(amountKobo)}.`,
    ai_draft: false,
  });

  return {
    ok: true,
    message: `Offered ${formatNaira(amountKobo)}. The creator decides next.`,
  };
}

/** No — said plainly, so the creator can stop waiting and take other work. */
export async function declineRate(
  dealId: string,
  note: string,
): Promise<RateOutcome> {
  const db = requireServiceClient();

  await db
    .from("deals")
    .update({
      status: "declined",
      proposed_fee_kobo: null,
      rate_agreed_at: new Date().toISOString(),
    })
    .eq("id", dealId);

  await db.from("deal_messages").insert({
    deal_id: dealId,
    direction: "outbound",
    channel: "manual",
    body: note.trim()
      ? `We will not be going ahead. ${note.trim()}`
      : "We will not be going ahead with this one.",
    ai_draft: false,
  });

  return { ok: true, message: "Declined. The creator has been told." };
}
