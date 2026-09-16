import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { Topbar } from "@/components/app/topbar";
import { Page, PageHead, StatStrip } from "@/components/app/page-head";
import { CampaignStatusBadge } from "@/components/app/status";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Panel,
  PanelBody,
  PanelFooter,
  PanelHeader,
  PanelTitle,
} from "@/components/ui/panel";
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
  getNeedsAction,
  getOrgMoneySummary,
  NOW,
} from "@/lib/data/queries";
import { formatNaira } from "@/lib/money";
import { cn, formatDate } from "@/lib/utils";

export const metadata = { title: "Overview" };

function greeting(now: Date) {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default async function OverviewPage() {
  const [org, user, money, campaigns, needsAction] = await Promise.all([
    getCurrentOrg(),
    getCurrentUser(),
    getOrgMoneySummary(),
    getCampaignSummaries(),
    getNeedsAction(),
  ]);

  const firstName = user.name.split(" ")[0];
  const active = campaigns.filter(
    (c) => !["completed", "cancelled"].includes(c.campaign.status),
  );

  return (
    <>
      <Topbar crumbs={[{ label: "Overview" }]} userName={user.name} unread={needsAction.length} />
      <Page>
        <PageHead
          kicker={`${formatDate(NOW)} · ${org.name}`}
          title={`${greeting(NOW)}, ${firstName}`}
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

        <StatStrip
          items={[
            {
              label: "Held in escrow",
              value: formatNaira(money.escrowKobo),
              note: "Committed to live campaigns",
            },
            {
              label: "Available in wallets",
              value: formatNaira(money.walletsKobo),
              note: "Ready to fund a campaign",
            },
            {
              label: "Paid to creators",
              value: formatNaira(money.paidOutKobo),
              note: "Across all campaigns",
              tone: "ok",
            },
          ]}
        />

        {/* The only thing on this page that asks for a decision. */}
        <Panel accent className="mb-5">
          <PanelHeader
            action={
              needsAction.length ? (
                <Badge tone="warn">{needsAction.length}</Badge>
              ) : null
            }
          >
            <PanelTitle>Needs your action</PanelTitle>
          </PanelHeader>

          {needsAction.length === 0 ? (
            <PanelBody className="py-10 text-center text-[13px] text-ink-3">
              Nothing is waiting on you. Outreach, reminders, content checks and
              payouts are running on their own.
            </PanelBody>
          ) : (
            <TableWrap>
              <Table>
                <TBody>
                  {needsAction.map((action) => (
                    <TR key={`${action.campaignId}-${action.label}`}>
                      <TD>
                        <Link href={action.href} className="block">
                          <CellMain>{action.label}</CellMain>
                          <CellSub>{action.detail}</CellSub>
                        </Link>
                      </TD>
                      <TD numeric className="w-40">
                        <CellSub>{action.campaignName}</CellSub>
                      </TD>
                      <TD numeric className="w-14">
                        <ArrowRight className="ml-auto size-4 text-ink-3" />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
          )}

          <PanelFooter>
            Everything else is running without you — outreach, reminders, content
            checks and payouts.
          </PanelFooter>
        </Panel>

        {/* The board. */}
        <Panel>
          <PanelHeader
            action={
              <Link
                href="/campaigns"
                className="text-[12.5px] font-medium text-brand-ink hover:underline"
              >
                All campaigns
              </Link>
            }
          >
            <PanelTitle>Active campaigns</PanelTitle>
          </PanelHeader>

          <TableWrap>
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH className="w-[32%]">Campaign</TH>
                  <TH>Stage</TH>
                  <TH numeric>Creators</TH>
                  <TH numeric>In escrow</TH>
                  <TH numeric>Paid out</TH>
                </TR>
              </THead>
              <TBody>
                {active.length === 0 ? (
                  <TableEmpty colSpan={5}>
                    No campaigns yet.{" "}
                    <Link href="/campaigns/new" className="text-brand-ink hover:underline">
                      Start one
                    </Link>
                    .
                  </TableEmpty>
                ) : (
                  active.map(
                    ({
                      campaign,
                      spaceName,
                      creatorsConfirmed,
                      creatorsTarget,
                      escrowHeldKobo,
                      paidOutKobo,
                    }) => (
                      <TR key={campaign.id}>
                        <TD>
                          <Link href={`/campaigns/${campaign.id}`} className="block">
                            <CellMain>{campaign.name}</CellMain>
                            <CellSub>
                              {spaceName} · ends {formatDate(campaign.deadline, NOW)}
                            </CellSub>
                          </Link>
                        </TD>
                        <TD>
                          <CampaignStatusBadge status={campaign.status} />
                        </TD>
                        <TD numeric>
                          <span
                            className={cn(
                              creatorsConfirmed === 0 && "text-ink-3",
                            )}
                          >
                            {creatorsConfirmed} of {creatorsTarget}
                          </span>
                        </TD>
                        <TD numeric>
                          <CellMain className="tabular-nums">
                            {formatNaira(escrowHeldKobo)}
                          </CellMain>
                        </TD>
                        <TD numeric>
                          <span
                            className={cn(
                              "tabular-nums",
                              paidOutKobo > 0 ? "text-ok" : "text-ink-3",
                            )}
                          >
                            {formatNaira(paidOutKobo)}
                          </span>
                        </TD>
                      </TR>
                    ),
                  )
                )}
              </TBody>
            </Table>
          </TableWrap>
        </Panel>
      </Page>
    </>
  );
}
