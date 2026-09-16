import { notFound } from "next/navigation";
import { Topbar } from "@/components/app/topbar";
import { Page, PageHead } from "@/components/app/page-head";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody } from "@/components/ui/panel";
import {
  getCampaign,
  getCampaignEscrow,
  getCurrentUser,
  getShortlist,
} from "@/lib/data/queries";
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

  const [rows, escrow] = await Promise.all([
    getShortlist(id),
    getCampaignEscrow(id),
  ]);

  const screened = 412; // Recorded on the shortlist run; fixed in the demo dataset.

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
          title="Approve the shortlist"
          subtitle={
            <>
              {rows.length} suggested from {screened} screened. Everyone here scored
              above the fraud threshold — the ones that did not are never shown.
            </>
          }
          actions={
            <div className="flex items-center gap-3">
              {rows.length > 0 && (
                <GenerateShortlistButton campaignId={campaign.id} regenerate />
              )}
              <Badge tone="warn" dot>
                Awaiting your approval
              </Badge>
            </div>
          }
        />

        {rows.length === 0 ? (
          <Panel>
            <PanelBody className="py-14 text-center">
              <span className="mx-auto grid size-11 place-items-center rounded-full bg-ground">
                <Sparkles className="size-5 text-ink-3" />
              </span>
              <p className="mt-3 text-[15px] font-medium">No shortlist yet</p>
              <p className="mx-auto mt-1 max-w-[44ch] text-[13.5px] text-ink-2">
                We will read every creator in the index who works on your
                platforms and passes the fraud threshold, and rank them against
                this brief.
              </p>
              <div className="mt-5 inline-block text-left">
                <GenerateShortlistButton campaignId={campaign.id} />
              </div>
            </PanelBody>
          </Panel>
        ) : (
          <ShortlistReview
            rows={rows}
            escrowAvailableKobo={escrow}
            platformFeeBps={campaign.platformFeeBps}
            campaignId={campaign.id}
            slotsTarget={15}
          />
        )}
      </Page>
    </>
  );
}
