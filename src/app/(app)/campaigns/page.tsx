import Link from "next/link";
import { Plus } from "lucide-react";
import { Topbar } from "@/components/app/topbar";
import { Page, PageHead } from "@/components/app/page-head";
import { CampaignStatusBadge } from "@/components/app/status";
import { Button } from "@/components/ui/button";
import { Panel, PanelFooter } from "@/components/ui/panel";
import {
  CellMain,
  CellSub,
  Table,
  TableEmpty,
  TableWrap,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui/table";
import {
  getCampaignSummaries,
  getCurrentUser,
  NOW,
} from "@/lib/data/queries";
import { formatNaira } from "@/lib/money";
import { cn, formatDate } from "@/lib/utils";

export const metadata = { title: "Campaigns" };

export default async function CampaignsPage() {
  const [user, campaigns] = await Promise.all([
    getCurrentUser(),
    getCampaignSummaries(),
  ]);

  const totalEscrow = campaigns.reduce((s, c) => s + c.escrowHeldKobo, 0);
  const totalPaid = campaigns.reduce((s, c) => s + c.paidOutKobo, 0);

  return (
    <>
      <Topbar crumbs={[{ label: "Campaigns" }]} userName={user.name} />
      <Page>
        <PageHead
          title="Campaigns"
          subtitle={
            <>
              {campaigns.length} across your clients ·{" "}
              <b className="font-semibold text-ink">{formatNaira(totalEscrow)}</b> held
              in escrow ·{" "}
              <b className="font-semibold text-ok">{formatNaira(totalPaid)}</b> paid to
              creators
            </>
          }
          actions={
            <>
              <Button variant="outline" asChild>
                <Link href="/wallet/deposit">Add funds</Link>
              </Button>
              <Button variant="brand" asChild>
                <Link href="/campaigns/new">
                  <Plus /> New campaign
                </Link>
              </Button>
            </>
          }
        />

        <Panel>
          <TableWrap>
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH className="w-[30%]">Campaign</TH>
                  <TH>Stage</TH>
                  <TH numeric className="hidden sm:table-cell">Creators</TH>
                  <TH numeric>In escrow</TH>
                  <TH numeric className="hidden lg:table-cell">Paid out</TH>
                  <TH className="hidden w-px md:table-cell" />
                </TR>
              </THead>
              <TBody>
                {campaigns.length === 0 ? (
                  <TableEmpty colSpan={6}>
                    No campaigns yet.{" "}
                    <Link
                      href="/campaigns/new"
                      className="text-brand-ink hover:underline"
                    >
                      Start one
                    </Link>
                    .
                  </TableEmpty>
                ) : (
                  campaigns.map((summary) => {
                    const { campaign, nextAction } = summary;
                    return (
                      <TR key={campaign.id}>
                        <TD>
                          <Link href={`/campaigns/${campaign.id}`} className="block">
                            <CellMain>{campaign.name}</CellMain>
                            <CellSub>
                              {summary.spaceName} · ends{" "}
                              {formatDate(campaign.deadline, NOW)}
                            </CellSub>
                          </Link>
                        </TD>
                        <TD>
                          <CampaignStatusBadge status={campaign.status} />
                        </TD>
                        <TD numeric className="hidden sm:table-cell">
                          <span
                            className={cn(
                              summary.creatorsConfirmed === 0 && "text-ink-3",
                            )}
                          >
                            {summary.creatorsConfirmed} of {summary.creatorsTarget}
                          </span>
                        </TD>
                        <TD numeric>
                          <CellMain className="tabular-nums">
                            {formatNaira(summary.escrowHeldKobo)}
                          </CellMain>
                        </TD>
                        <TD numeric className="hidden lg:table-cell">
                          <span
                            className={cn(
                              "tabular-nums",
                              summary.paidOutKobo > 0 ? "text-ok" : "text-ink-3",
                            )}
                          >
                            {formatNaira(summary.paidOutKobo)}
                          </span>
                        </TD>
                        <TD numeric className="hidden md:table-cell">
                          {nextAction ? (
                            <Button variant="outline" size="sm" asChild>
                              <Link href={nextAction.href}>
                                {shortAction(nextAction.label)}
                              </Link>
                            </Button>
                          ) : (
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/campaigns/${campaign.id}`}>Open</Link>
                            </Button>
                          )}
                        </TD>
                      </TR>
                    );
                  })
                )}
              </TBody>
            </Table>
          </TableWrap>
          <PanelFooter>
            Margin, spend and per-creator detail live on each campaign.{" "}
            <Link href="/reports" className="font-medium text-brand-ink hover:underline">
              See all reports
            </Link>
          </PanelFooter>
        </Panel>
      </Page>
    </>
  );
}

/** The board button says the verb, not the sentence — the row already has context. */
function shortAction(label: string): string {
  if (label.startsWith("Fund")) return "Fund";
  if (label.startsWith("Approve a shortlist")) return "Approve shortlist";
  if (label.startsWith("Review")) return "Review drafts";
  if (label.startsWith("Approve")) return "Approve messages";
  if (label.startsWith("Release")) return "Release payment";
  if (label.startsWith("Return")) return "Return budget";
  return "Open";
}
