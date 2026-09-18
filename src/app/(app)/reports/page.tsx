import Link from "next/link";
import { Download } from "lucide-react";
import { Topbar } from "@/components/app/topbar";
import { Page, PageHead, StatStrip } from "@/components/app/page-head";
import { CampaignStatusBadge } from "@/components/app/status";
import { Button } from "@/components/ui/button";
import { Panel, PanelFooter, PanelHeader, PanelTitle } from "@/components/ui/panel";
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
  getCurrentOrg,
  getCurrentUser,
  getOrgMoneySummary,
  NOW,
} from "@/lib/data/queries";
import { formatNaira } from "@/lib/money";
import { cn, formatDate } from "@/lib/utils";

export const metadata = { title: "Reports" };

/**
 * What the money did.
 *
 * Deliberately not a dashboard of engagement graphs: v1 does not read post
 * metrics, and inventing a chart from numbers we have not verified would be
 * worse than showing none. What is here is what the ledger knows — spend,
 * margin, and cost per creator — which is what an agency has to report to a
 * client anyway.
 */
export default async function ReportsPage() {
  const [org, user, money, campaigns] = await Promise.all([
    getCurrentOrg(),
    getCurrentUser(),
    getOrgMoneySummary(),
    getCampaignSummaries(),
  ]);

  const withSpend = campaigns.filter((c) => c.paidOutKobo > 0 || c.escrowHeldKobo > 0);
  const totalCreatorSpend = campaigns.reduce((s, c) => s + c.paidOutKobo, 0);

  // The agency's margin is theirs alone. It is computed here and never sent to
  // a client view.
  const marginBps = org.defaultMarginBps ?? 0;
  const estimatedMargin = Math.floor((totalCreatorSpend * marginBps) / 10_000);

  return (
    <>
      <Topbar crumbs={[{ label: "Reports" }]} userName={user.name} />
      <Page>
        <PageHead
          title="Reports"
          subtitle="Everything below comes from the ledger, so it reconciles with the money that actually moved."
          actions={
            <Button variant="outline" asChild>
              <a href="/api/export?kind=ledger">
                <Download /> Export CSV
              </a>
            </Button>
          }
        />

        <StatStrip
          items={[
            {
              label: "Paid to creators",
              value: formatNaira(totalCreatorSpend),
              note: "Across every campaign",
              tone: "ok",
            },
            {
              label: "Still in escrow",
              value: formatNaira(money.escrowKobo),
              note: "Committed but not yet released",
            },
            ...(marginBps
              ? [
                  {
                    label: `Your margin · ${marginBps / 100}%`,
                    value: formatNaira(estimatedMargin),
                    note: "Never shown to a client",
                  },
                ]
              : []),
          ]}
        />

        <Panel>
          <PanelHeader
            action={
              <Link
                href="/campaigns"
                className="inline-flex min-h-9 items-center text-[12.5px] font-medium text-brand-ink hover:underline sm:min-h-0"
              >
                All campaigns
              </Link>
            }
          >
            <PanelTitle>By campaign</PanelTitle>
          </PanelHeader>
          <TableWrap>
            <Table labels={["Campaign", "Stage", "Creators", "Paid out", "In escrow", "Avg per creator"]}>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH className="w-[28%]">Campaign</TH>
                  <TH className="hidden md:table-cell">Stage</TH>
                  <TH numeric className="hidden sm:table-cell">Creators</TH>
                  <TH numeric>Paid out</TH>
                  <TH numeric className="hidden lg:table-cell">In escrow</TH>
                  <TH numeric className="hidden xl:table-cell">Avg per creator</TH>
                </TR>
              </THead>
              <TBody>
                {withSpend.length === 0 ? (
                  <TableEmpty colSpan={6}>
                    Nothing to report yet. Numbers appear here as campaigns are
                    funded and creators are paid.
                  </TableEmpty>
                ) : (
                  withSpend.map((summary) => {
                    const perCreator =
                      summary.creatorsConfirmed > 0
                        ? Math.floor(summary.paidOutKobo / summary.creatorsConfirmed)
                        : 0;
                    return (
                      <TR key={summary.campaign.id}>
                        <TD>
                          <Link
                            href={`/campaigns/${summary.campaign.id}?tab=results`}
                            className="block"
                          >
                            <CellMain>{summary.campaign.name}</CellMain>
                            <CellSub>
                              {summary.spaceName} ·{" "}
                              {formatDate(summary.campaign.deadline, NOW)}
                            </CellSub>
                          </Link>
                        </TD>
                        <TD className="hidden md:table-cell">
                          <CampaignStatusBadge status={summary.campaign.status} />
                        </TD>
                        <TD numeric className="hidden sm:table-cell">
                          {summary.creatorsConfirmed} of {summary.creatorsTarget}
                        </TD>
                        <TD numeric>
                          <CellMain
                            className={cn(
                              "tabular-nums",
                              summary.paidOutKobo > 0 && "text-ok",
                            )}
                          >
                            {formatNaira(summary.paidOutKobo)}
                          </CellMain>
                        </TD>
                        <TD numeric className="hidden lg:table-cell">
                          {formatNaira(summary.escrowHeldKobo)}
                        </TD>
                        <TD numeric className="hidden xl:table-cell">
                          {perCreator > 0 ? formatNaira(perCreator) : "—"}
                        </TD>
                      </TR>
                    );
                  })
                )}
              </TBody>
            </Table>
          </TableWrap>
          <PanelFooter>
            Reach and engagement figures are entered by hand in v1. We would rather
            show nothing than a number we have not verified against the post
            itself.
          </PanelFooter>
        </Panel>

        <Panel className="mt-4">
          <PanelHeader>
            <PanelTitle>Client-facing report</PanelTitle>
          </PanelHeader>
          <div className="p-5 text-[13.5px] leading-relaxed text-ink-2">
            <p>
              Each campaign has a read-only link you can send to the client. It
              shows the creators, the published posts and the spend they were
              charged — and never your margin, your other clients, or what the
              creators were actually paid.
            </p>
            <Button variant="outline" size="sm" className="mt-3" asChild>
              <a href="/api/export?kind=campaigns">
                <Download /> Export every campaign
              </a>
            </Button>
          </div>
        </Panel>
      </Page>
    </>
  );
}
