import Link from "next/link";
import { ArrowRight, CheckCheck } from "lucide-react";
import { Topbar } from "@/components/app/topbar";
import { Page, PageHead } from "@/components/app/page-head";
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
  TableWrap,
  TBody,
  TD,
  TR,
} from "@/components/ui/table";
import { getCurrentUser, getNeedsAction } from "@/lib/data/queries";

export const metadata = { title: "Approvals" };

const TONE_LABEL = {
  warn: "Money is waiting",
  info: "Someone is waiting",
  danger: "Needs attention",
  neutral: "Ready",
} as const;

/**
 * Everything waiting on a person, across every campaign.
 *
 * The dashboard shows this too, but truncated to what fits. This is the full
 * queue, ordered the same way: things that stop money moving first, then things
 * where a creator is waiting on a reply, then everything else. An agency running
 * twenty campaigns should be able to work top to bottom and stop when it is empty.
 */
export default async function ApprovalsPage() {
  const [user, actions] = await Promise.all([getCurrentUser(), getNeedsAction()]);

  const grouped = {
    warn: actions.filter((a) => a.tone === "warn"),
    info: actions.filter((a) => a.tone === "info"),
    danger: actions.filter((a) => a.tone === "danger"),
    neutral: actions.filter((a) => a.tone === "neutral"),
  };

  return (
    <>
      <Topbar
        crumbs={[{ label: "Approvals" }]}
        userName={user.name}
        unread={actions.length}
      />
      <Page>
        <PageHead
          title="Approvals"
          subtitle={
            actions.length
              ? `${actions.length} decision${actions.length === 1 ? "" : "s"} waiting on you. Everything else is running on its own.`
              : "Nothing is waiting on you."
          }
        />

        {actions.length === 0 ? (
          <Panel>
            <PanelBody className="py-16 text-center">
              <CheckCheck className="mx-auto size-6 text-ok" />
              <p className="mt-3 text-[14px] font-medium">You are clear</p>
              <p className="mx-auto mt-1 max-w-sm text-[13px] text-ink-2">
                Outreach, reminders, content checks and payouts are all running
                without you. We will put something here when a decision is needed.
              </p>
            </PanelBody>
          </Panel>
        ) : (
          <div className="space-y-5">
            {(["warn", "danger", "info", "neutral"] as const).map((tone) =>
              grouped[tone].length === 0 ? null : (
                <Panel key={tone} accent={tone === "warn"}>
                  <PanelHeader
                    action={<Badge tone={tone}>{grouped[tone].length}</Badge>}
                  >
                    <PanelTitle>{TONE_LABEL[tone]}</PanelTitle>
                  </PanelHeader>
                  <TableWrap>
                    <Table>
                      <TBody>
                        {grouped[tone].map((action) => (
                          <TR key={`${action.campaignId}-${action.label}`}>
                            <TD>
                              <Link href={action.href} className="block">
                                <CellMain>{action.label}</CellMain>
                                <CellSub>{action.detail}</CellSub>
                              </Link>
                            </TD>
                            <TD numeric className="hidden w-44 md:table-cell">
                              <CellSub>{action.campaignName}</CellSub>
                            </TD>
                            <TD numeric className="w-12">
                              <ArrowRight className="ml-auto size-4 text-ink-3" />
                            </TD>
                          </TR>
                        ))}
                      </TBody>
                    </Table>
                  </TableWrap>
                </Panel>
              ),
            )}
            <Panel>
              <PanelFooter className="text-ink-2">
                Ordered by what it costs to leave undone: a campaign that cannot
                start, then a creator waiting on a reply, then work that is simply
                ready.
              </PanelFooter>
            </Panel>
          </div>
        )}
      </Page>
    </>
  );
}
