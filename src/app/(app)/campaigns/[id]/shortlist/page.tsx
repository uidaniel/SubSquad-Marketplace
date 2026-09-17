import Link from "next/link";
import { notFound } from "next/navigation";
import { Layers, Sparkles, Users } from "lucide-react";
import { Topbar } from "@/components/app/topbar";
import { Page, PageHead } from "@/components/app/page-head";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody } from "@/components/ui/panel";
import {
  getCampaign,
  getCampaignEscrow,
  getCampaignSlots,
  getCurrentUser,
  getShortlist,
} from "@/lib/data/queries";
import { eligiblePool } from "@/lib/ai/shortlist";
import { env } from "@/lib/env";
import { ShortlistReview } from "./shortlist-review";
import { GenerateShortlistButton } from "./generate-button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await getCampaign(id);
  return { title: campaign ? `Shortlist · ${campaign.name}` : "Shortlist" };
}

export default async function ShortlistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [campaign, user] = await Promise.all([getCampaign(id), getCurrentUser()]);
  if (!campaign) notFound();

  const [rows, escrow, slots] = await Promise.all([
    getShortlist(id),
    getCampaignEscrow(id),
    getCampaignSlots(id),
  ]);

  // The real size of the pool, not a number written into the page. In demo mode
  // there is no service client to ask, so the count is the fixture's own.
  const pool = env.demoMode
    ? { eligible: 8, platforms: campaign.brief.platforms, hasSlots: slots.length > 0 }
    : await eligiblePool(id);

  const slotsTarget = slots.reduce((sum, s) => sum + s.count, 0);
  const platformNames = pool.platforms.join(" and ") || "your platforms";

  return (
    <>
      <Topbar
        crumbs={[
          { label: "Campaigns", href: "/campaigns" },
          { label: campaign.name, href: `/campaigns/${campaign.id}` },
          { label: "Shortlist" },
        ]}
        userName={user.name}
      />
      <Page>
        <PageHead
          kicker={`${campaign.endBrandName} · ${campaign.name}`}
          title={rows.length > 0 ? "Approve the shortlist" : "Pick your creators"}
          subtitle={
            rows.length > 0
              ? `${rows.length} suggested from ${pool.eligible} screened. Everyone here scored above the fraud threshold — the ones that did not are never shown.`
              : `${slotsTarget} creator${slotsTarget === 1 ? "" : "s"} needed for this campaign. The money is already in escrow, so nobody is waiting on a budget decision.`
          }
          actions={
            rows.length > 0 ? (
              <div className="flex flex-wrap items-center gap-3">
                <GenerateShortlistButton campaignId={campaign.id} regenerate />
                <Badge tone="warn" dot>
                  Awaiting your approval
                </Badge>
              </div>
            ) : null
          }
        />

        {rows.length > 0 ? (
          <ShortlistReview
            rows={rows}
            escrowAvailableKobo={escrow}
            platformFeeBps={campaign.platformFeeBps}
            campaignId={campaign.id}
            slotsTarget={slotsTarget}
          />
        ) : (
          <EmptyState
            campaignId={campaign.id}
            eligible={pool.eligible}
            hasSlots={pool.hasSlots}
            platformNames={platformNames}
            slotsTarget={slotsTarget}
          />
        )}
      </Page>
    </>
  );
}

/**
 * Before a shortlist exists.
 *
 * The old version was a tall empty panel with a centred icon and one button
 * floating in it — a lot of white space saying nothing. What an agency needs
 * here is the two facts that decide whether the button is worth pressing: how
 * many creators are actually available, and how many the campaign needs. Those
 * go above the button, not in a paragraph after it.
 *
 * It also has to handle the case where there is nothing to search: no
 * deliverables, or an empty index. A button that can only fail is worse than a
 * sentence explaining what to do instead.
 */
function EmptyState({
  campaignId,
  eligible,
  hasSlots,
  platformNames,
  slotsTarget,
}: {
  campaignId: string;
  eligible: number;
  hasSlots: boolean;
  platformNames: string;
  slotsTarget: number;
}) {
  if (!hasSlots) {
    return (
      <Panel>
        <PanelBody className="max-w-[46ch] space-y-3 py-8">
          <p className="text-[15px] font-medium">
            This campaign has no deliverables yet
          </p>
          <p className="text-[13.5px] leading-relaxed text-ink-2">
            Add what you want made — how many videos, on which platform, at what
            fee — and we can match creators against it.
          </p>
          <Button size="sm" asChild>
            <Link href={`/campaigns/${campaignId}`}>Add deliverables</Link>
          </Button>
        </PanelBody>
      </Panel>
    );
  }

  if (eligible === 0) {
    return (
      <Panel>
        <PanelBody className="max-w-[46ch] space-y-3 py-8">
          <p className="text-[15px] font-medium">
            No creators in your index work on {platformNames}
          </p>
          <p className="text-[13.5px] leading-relaxed text-ink-2">
            Import creators who post there, or change this campaign&apos;s
            deliverables to a platform your index already covers.
          </p>
          <Button size="sm" asChild>
            <Link href="/creators">Import creators</Link>
          </Button>
        </PanelBody>
      </Panel>
    );
  }

  return (
    <Panel>
      <div className="grid divide-y divide-line sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <Fact
          icon={<Users className="size-4" />}
          value={eligible.toLocaleString()}
          label={`creators in your index on ${platformNames}`}
          note="Suspended accounts and anyone who opted out are already excluded."
        />
        <Fact
          icon={<Layers className="size-4" />}
          value={slotsTarget.toLocaleString()}
          label={`slot${slotsTarget === 1 ? "" : "s"} to fill on this campaign`}
          note="We suggest more than you need so you have a real choice."
        />
      </div>

      <PanelBody className="border-t border-line">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-[52ch] space-y-1.5">
            <p className="flex items-center gap-2 text-[14px] font-medium">
              <Sparkles className="size-4 text-ink-3" />
              Rank them against this brief
            </p>
            <p className="text-[13.5px] leading-relaxed text-ink-2">
              We read each creator&apos;s recent posts and score them on how well
              they fit the product, the audience and the tone — then propose a
              fee inside your rate band. Anyone below the fraud threshold is
              never shown.
            </p>
          </div>
          <div className="shrink-0">
            <GenerateShortlistButton campaignId={campaignId} />
          </div>
        </div>
      </PanelBody>
    </Panel>
  );
}

function Fact({
  icon,
  value,
  label,
  note,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  note: string;
}) {
  return (
    <div className="px-5 py-4">
      <p className="flex items-center gap-2 text-[12.5px] font-medium uppercase tracking-wide text-ink-3">
        {icon}
        {label}
      </p>
      <p className="mt-1.5 text-[26px] font-semibold leading-none tabular-nums">
        {value}
      </p>
      <p className="mt-2 text-[12.5px] leading-relaxed text-ink-3">{note}</p>
    </div>
  );
}
