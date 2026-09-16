import { notFound } from "next/navigation";
import { Check, FileText, Lock, ShieldCheck } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireServiceClient } from "@/lib/supabase/service";
import { env } from "@/lib/env";
import { applyBps, formatNaira } from "@/lib/money";
import { formatCount, formatDate, formatPercent, formatRelative } from "@/lib/utils";

export const metadata = { title: "A deal for you" };

/**
 * The guest brand page.
 *
 * Reached from an email by someone with no account, who has agreed a deal with
 * a creator and now has to send money to a company they have never heard of.
 * Everything on the page is arranged around that: who the creator is and what
 * they have delivered before, exactly what is owed, and the fact that the money
 * is held rather than forwarded.
 *
 * There is no account creation here on purpose. Asking a brand to sign up
 * before they can pay is how a deal dies — the offer to create an account comes
 * after the money is in.
 */
export default async function GuestDealPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const view = await guestDealByToken(token);
  if (!view) notFound();

  const { deal, creator, profile, brand, paidKobo } = view;

  // On a creator-initiated deal the creator can absorb the platform fee. When
  // they have not, it is added on top of what the brand agreed with them.
  const platformFee = applyBps(deal.feeKobo, deal.platformFeeBps);
  const total = deal.feePaidBy === "creator" ? deal.feeKobo : deal.feeKobo + platformFee;
  const outstanding = Math.max(0, total - paidKobo);
  const half = Math.ceil(total / 2);

  return (
    <main className="mx-auto min-h-screen w-full max-w-[560px] px-4 pb-32 pt-6">
      <header className="mb-6 flex items-center gap-2">
        <span className="grid size-6 place-items-center rounded-[6px] bg-brand text-[11px] font-bold text-white">
          SS
        </span>
        <span className="text-[15px] font-semibold">SubSquad</span>
        {paidKobo > 0 && (
          <Badge tone={outstanding === 0 ? "ok" : "warn"} dot className="ml-auto">
            {outstanding === 0 ? "Fully funded" : "Part funded"}
          </Badge>
        )}
      </header>

      <p className="text-[14px] leading-relaxed text-ink-2">
        {creator.displayName} set this up for {brand?.brandName ?? "your brand"}. Pay
        into escrow and they get to work — the money only reaches them once the post
        is live.
      </p>

      {/* Who you are paying, and their record. */}
      <section className="mt-5 rounded-[var(--radius-lg)] border border-line bg-surface p-5">
        <div className="flex items-center gap-3.5">
          <Avatar name={creator.displayName} size="lg" />
          <div className="min-w-0">
            <p className="text-[16px] font-semibold">@{creator.handle}</p>
            <p className="text-[12.5px] text-ink-2">
              {formatCount(profile?.followers ?? 0)} followers ·{" "}
              {formatPercent(profile?.engagementRate ?? 0)} engagement ·{" "}
              {profile?.locationCity}
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-[var(--radius-sm)] bg-line">
          <Stat label="Deals done" value={String(view.dealsCompleted)} />
          <Stat label="On time" value={view.onTime} />
          <Stat label="Disputes" value="0" />
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-ink-3">
          This record is built from deals completed on SubSquad, not from anything
          the creator typed in.
        </p>
      </section>

      {/* What you are paying for. */}
      <section className="mt-4 rounded-[var(--radius-lg)] border border-line bg-surface">
        <div className="border-b border-line px-5 py-3.5">
          <h2 className="text-[14px] font-semibold">The deal</h2>
        </div>
        <dl className="divide-y divide-line">
          <Row label="Deliverable" value="1 TikTok video" />
          <Row
            label="Due"
            value={`${formatDate(deal.deadline)} · ${formatRelative(deal.deadline)}`}
          />
          <Row label="Usage rights" value="90 days organic" />
        </dl>

        <div className="space-y-2.5 border-t border-line px-5 py-4 text-[13.5px]">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-ink-2">Creator fee</span>
            <span className="tabular-nums">{formatNaira(deal.feeKobo)}</span>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-ink-2">
              SubSquad fee · {deal.platformFeeBps / 100}%
              {deal.feePaidBy === "creator" && (
                <span className="block text-[12px] text-ink-3">
                  {creator.displayName.split(" ")[0]} is covering this
                </span>
              )}
            </span>
            <span className="tabular-nums">
              {deal.feePaidBy === "creator" ? "—" : formatNaira(platformFee)}
            </span>
          </div>
          {paidKobo > 0 && (
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-ink-2">Already paid</span>
              <span className="tabular-nums text-ok">−{formatNaira(paidKobo)}</span>
            </div>
          )}
          <div className="flex items-baseline justify-between gap-4 border-t border-ink pt-2.5">
            <span className="font-medium">
              {paidKobo > 0 ? "Still to pay" : "Total"}
            </span>
            <span className="text-[22px] font-semibold tabular-nums">
              {formatNaira(outstanding)}
            </span>
          </div>
        </div>
      </section>

      <section className="mt-4 flex items-start gap-3 rounded-[var(--radius-lg)] bg-surface-2 p-4">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-ok" />
        <div className="text-[12.5px] leading-relaxed text-ink-2">
          <p className="font-medium text-ink">Your money is held, not forwarded.</p>
          <p className="mt-1">
            SubSquad holds it until you have seen the content and confirmed the post
            is live. If {creator.displayName.split(" ")[0]} does not deliver, it comes
            back to you in full.
          </p>
        </div>
      </section>

      <a
        href="#"
        className="mt-4 flex items-center gap-2 text-[13px] font-medium text-brand-ink hover:underline"
      >
        <FileText className="size-4" /> Read the contract before you pay
      </a>

      {outstanding > 0 ? (
        <div className="fixed inset-x-0 bottom-0 border-t border-line bg-ground/95 px-4 py-3 backdrop-blur-md">
          <div className="mx-auto w-full max-w-[560px]">
            <Button variant="brand" size="lg" block>
              <Lock /> Pay {formatNaira(outstanding)} into escrow
            </Button>
            {paidKobo === 0 && (
              <Button variant="outline" block className="mt-2">
                Pay half now — {formatNaira(half)}
              </Button>
            )}
            <p className="mt-2 text-center text-[11.5px] text-ink-3">
              Card, bank transfer or USSD via Paystack.
              {env.DRY_RUN ? " Test mode — no card is charged." : ""}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-5 flex items-start gap-3 rounded-[var(--radius-lg)] border border-ok/30 bg-ok-soft p-4">
          <Check className="mt-0.5 size-5 shrink-0 text-ok" />
          <div className="text-[13px] leading-relaxed text-ok">
            <p className="font-medium">Funded in full.</p>
            <p className="mt-1">
              {creator.displayName.split(" ")[0]} has been told to start. You will get
              a link to review the content before anything goes live.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface px-2 py-3 text-center">
      <p className="text-[17px] font-semibold tabular-nums tracking-[-0.02em]">
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-ink-2">{label}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-5 py-3">
      <dt className="text-[13px] text-ink-2">{label}</dt>
      <dd className="text-right text-[13.5px] font-medium">{value}</dd>
    </div>
  );
}

/**
 * Looks a deal up by its brand token.
 *
 * The token is the only credential — the brand has no account — so it is long,
 * random, and scoped to exactly one deal. Nothing about the creator's other
 * work, other brands, or SubSquad's other customers is reachable from it.
 */
async function guestDealByToken(token: string) {
  if (env.demoMode) return null;

  const db = requireServiceClient();
  const { data: deal } = await db
    .from("deals")
    .select("*")
    .eq("brand_approval_token", token)
    .maybeSingle();
  if (!deal) return null;

  const [{ data: creator }, { data: profile }, { data: brand }, { data: payments }] =
    await Promise.all([
      db.from("creators").select("*").eq("id", deal.creator_id).single(),
      db
        .from("creator_profiles")
        .select("*")
        .eq("creator_id", deal.creator_id)
        .maybeSingle(),
      db.from("guest_brands").select("*").eq("deal_id", deal.id).maybeSingle(),
      db.from("payments").select("amount_kobo, status").eq("deal_id", deal.id),
    ]);

  const { data: history } = await db
    .from("deals")
    .select("id, status, deadline, published_at")
    .eq("creator_id", deal.creator_id)
    .eq("status", "paid");

  const paidDeals = history ?? [];
  const onTime = paidDeals.filter(
    (d) => d.published_at && new Date(d.published_at) <= new Date(d.deadline),
  ).length;

  return {
    deal: {
      id: deal.id,
      feeKobo: Number(deal.fee_kobo),
      platformFeeBps: Number(deal.platform_fee_bps),
      feePaidBy: deal.fee_paid_by as "brand" | "creator",
      deadline: deal.deadline as string,
      status: deal.status as string,
    },
    creator: {
      displayName: creator!.display_name as string,
      handle: creator!.handle as string,
    },
    profile: profile
      ? {
          followers: Number(profile.followers),
          engagementRate: Number(profile.engagement_rate),
          locationCity: profile.location_city as string | null,
        }
      : null,
    brand: brand ? { brandName: brand.brand_name as string } : null,
    paidKobo: (payments ?? [])
      .filter((p) => p.status === "success")
      .reduce((sum, p) => sum + Number(p.amount_kobo), 0),
    dealsCompleted: paidDeals.length,
    onTime: paidDeals.length > 0 ? `${onTime}/${paidDeals.length}` : "—",
  };
}
