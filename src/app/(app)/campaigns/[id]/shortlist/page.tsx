import { notFound } from "next/navigation";
import { Topbar } from "@/components/app/topbar";
import { Page, PageHead } from "@/components/app/page-head";
import { Badge } from "@/components/ui/badge";
import {
  getBalance,
  getCampaign,
  getCurrentUser,
  getShortlist,
} from "@/lib/data/queries";
import { escrowAccountFor } from "@/lib/demo/data";
import { ShortlistReview } from "./shortlist-review";

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
    getBalance(escrowAccountFor(id)),
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
          actions={<Badge tone="warn" dot>Awaiting your approval</Badge>}
        />

        <ShortlistReview
          rows={rows}
          escrowAvailableKobo={escrow}
          platformFeeBps={campaign.platformFeeBps}
          campaignId={campaign.id}
          slotsTarget={15}
        />
      </Page>
    </>
  );
}
