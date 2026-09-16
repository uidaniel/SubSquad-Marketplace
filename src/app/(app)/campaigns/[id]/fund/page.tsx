import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { Topbar } from "@/components/app/topbar";
import { Page, PageHead } from "@/components/app/page-head";
import { ActionButton } from "@/components/app/action-button";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelFooter, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { requireServiceClient } from "@/lib/supabase/service";
import { env } from "@/lib/env";
import { getCampaignSummary, getCurrentUser, getWalletBalances } from "@/lib/data/queries";
import { fundingRequiredFor } from "@/lib/ledger/transactions";
import { formatNaira } from "@/lib/money";
import { cn } from "@/lib/utils";
import { fundCampaign } from "../../../actions";

export const metadata = { title: "Fund campaign" };

/**
 * Funding a campaign.
 *
 * The screen's job is to make the arithmetic impossible to get wrong: creator
 * fees, the platform fee on top, and whether the client's wallet actually
 * covers it — before the button is pressed, not after it fails.
 */
export default async function FundPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [summary, user, wallets] = await Promise.all([
    getCampaignSummary(id),
    getCurrentUser(),
    getWalletBalances(),
  ]);
  if (!summary) notFound();

  const { campaign } = summary;
  const wallet = wallets.find((w) => w.space.id === campaign.spaceId);
  const slots = await slotsFor(campaign.id);

  const creatorFees = slots.reduce((s, x) => s + x.feeKobo * x.count, 0);
  const required = creatorFees > 0 ? fundingRequiredFor(creatorFees, campaign.platformFeeBps) : 0;
  const platformFee = required - creatorFees;
  const available = wallet?.availableKobo ?? 0;
  const shortfall = Math.max(0, required - available);

  return (
    <>
      <Topbar
        crumbs={[
          { label: "Campaigns", href: "/campaigns" },
          { label: campaign.name, href: `/campaigns/${campaign.id}` },
          { label: "Fund" },
        ]}
        userName={user.name}
      />
      <Page className="max-w-[640px]">
        <PageHead
          kicker={`${summary.spaceName} · ${campaign.name}`}
          title="Fund this campaign"
          subtitle="Nobody is contacted until the money is in escrow. That is why creators reply to us."
        />

        <Panel>
          <PanelHeader>
            <PanelTitle>What it costs</PanelTitle>
          </PanelHeader>
          <PanelBody className="space-y-3 text-[13.5px]">
            {slots.map((slot) => (
              <div key={slot.id} className="flex items-baseline justify-between gap-4">
                <span className="text-ink-2">
                  {slot.count} × {readableDeliverable(slot.deliverableType)} at{" "}
                  {formatNaira(slot.feeKobo)}
                </span>
                <span className="tabular-nums">
                  {formatNaira(slot.feeKobo * slot.count)}
                </span>
              </div>
            ))}

            {slots.length === 0 && (
              <p className="text-ink-3">
                This campaign has no deliverables yet, so there is nothing to fund.
              </p>
            )}

            {slots.length > 0 && (
              <>
                <div className="flex items-baseline justify-between gap-4 border-t border-line pt-3">
                  <span className="text-ink-2">Creator fees</span>
                  <span className="tabular-nums">{formatNaira(creatorFees)}</span>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-ink-2">
                    SubSquad fee · {campaign.platformFeeBps / 100}%, charged on top
                  </span>
                  <span className="tabular-nums">{formatNaira(platformFee)}</span>
                </div>
                <div className="flex items-baseline justify-between gap-4 border-t border-ink pt-3">
                  <span className="font-medium">To lock in escrow</span>
                  <span className="text-[20px] font-semibold tabular-nums">
                    {formatNaira(required)}
                  </span>
                </div>
              </>
            )}
          </PanelBody>

          <div className="border-t border-line px-5 py-4">
            <div className="flex items-baseline justify-between gap-4 text-[13.5px]">
              <span className="text-ink-2">{summary.spaceName}&apos;s wallet holds</span>
              <span
                className={cn(
                  "font-medium tabular-nums",
                  shortfall > 0 ? "text-danger" : "text-ok",
                )}
              >
                {formatNaira(available)}
              </span>
            </div>

            {shortfall > 0 ? (
              <div className="mt-4 rounded-[var(--radius-sm)] bg-danger-soft px-3 py-3 text-[13px] leading-relaxed text-danger">
                <p className="font-medium">
                  {formatNaira(shortfall)} short.
                </p>
                <p className="mt-1">
                  Add funds to this client&apos;s wallet before funding the campaign
                  — the escrow has to cover the creator fees and the platform fee,
                  or the last creator to publish could not be paid.
                </p>
                <Button variant="outline" size="sm" className="mt-3" asChild>
                  <Link href="/wallet/deposit">Add funds</Link>
                </Button>
              </div>
            ) : (
              slots.length > 0 && (
                <div className="mt-4">
                  <ActionButton
                    action={fundCampaign.bind(null, campaign.id)}
                    variant="brand"
                    size="lg"
                    block
                    confirm={`Lock ${formatNaira(required)} in escrow for ${campaign.name}? It stays the client's money and comes back if the campaign is cancelled.`}
                  >
                    <Lock /> Lock {formatNaira(required)} in escrow
                  </ActionButton>
                </div>
              )
            )}
          </div>

          <PanelFooter>
            Escrowed money is still the client&apos;s. Whatever is not paid to a
            creator returns to their wallet when the campaign closes.
            {env.DRY_RUN ? " DRY_RUN does not affect this — the ledger is real." : ""}
          </PanelFooter>
        </Panel>
      </Page>
    </>
  );
}

async function slotsFor(campaignId: string) {
  if (env.demoMode) {
    const { DEMO_SLOTS } = await import("@/lib/demo/data");
    return DEMO_SLOTS.filter((s) => s.campaignId === campaignId).map((s) => ({
      id: s.id,
      deliverableType: s.deliverableType as string,
      count: s.count,
      feeKobo: s.feeKobo,
    }));
  }
  const { data } = await requireServiceClient()
    .from("campaign_slots")
    .select("*")
    .eq("campaign_id", campaignId);
  return (data ?? []).map((s) => ({
    id: s.id as string,
    deliverableType: s.deliverable_type as string,
    count: Number(s.count),
    feeKobo: Number(s.fee_kobo),
  }));
}

function readableDeliverable(type: string): string {
  return (
    {
      tiktok_video: "TikTok video",
      ig_reel: "Instagram reel",
      ig_story: "Instagram story",
      yt_short: "YouTube short",
      x_post: "X post",
    }[type] ?? type
  );
}
