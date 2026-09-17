import Link from "next/link";
import { Topbar } from "@/components/app/topbar";
import { Page, PageHead } from "@/components/app/page-head";
import { DealStatusBadge } from "@/components/app/status";
import { Avatar } from "@/components/ui/avatar";
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
import { getAllDeals, getCurrentUser, NOW } from "@/lib/data/queries";
import { STAGE_META, STAGES, stageOf, type Stage } from "@/lib/deals/stages";
import { formatNaira } from "@/lib/money";
import { cn, formatRelative } from "@/lib/utils";

export const metadata = { title: "Deals" };

/**
 * Every deal, grouped by whose move it is.
 *
 * There was no way to see deals across campaigns at all — an agency running
 * five campaigns had to open each one and read a table. The question they
 * actually ask is "what is waiting on me", which cuts across campaigns entirely.
 *
 * Stages that need a person come first and are counted in the tab; the rest are
 * there to be checked rather than worked. Filtering is a link rather than a
 * control, so a stage can be bookmarked and sent to a colleague.
 */
export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>;
}) {
  const [{ stage }, user, deals] = await Promise.all([
    searchParams,
    getCurrentUser(),
    getAllDeals(),
  ]);

  const active = STAGES.includes(stage as Stage) ? (stage as Stage) : null;

  const counts = new Map<Stage, number>();
  for (const deal of deals) {
    const s = stageOf(deal.status);
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }

  const shown = active ? deals.filter((d) => stageOf(d.status) === active) : deals;
  const waitingOnYou = deals.filter(
    (d) => STAGE_META[stageOf(d.status)].waitingOn === "you",
  ).length;

  return (
    <>
      <Topbar crumbs={[{ label: "Deals" }]} userName={user.name} />
      <Page>
        <PageHead
          title="Deals"
          subtitle={
            deals.length === 0
              ? "No deals yet. They appear here once you approve a shortlist."
              : waitingOnYou > 0
                ? `${deals.length} deals. ${waitingOnYou} waiting on you.`
                : `${deals.length} deals. Nothing waiting on you.`
          }
        />

        {/* One row, scrollable on a phone rather than wrapped into four. */}
        <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1">
          <StageTab
            href="/deals"
            label="All"
            count={deals.length}
            active={active === null}
          />
          {STAGES.map((s) => {
            const count = counts.get(s) ?? 0;
            if (count === 0 && s !== active) return null;
            return (
              <StageTab
                key={s}
                href={`/deals?stage=${s}`}
                label={STAGE_META[s].label}
                count={count}
                active={active === s}
                urgent={STAGE_META[s].waitingOn === "you" && count > 0}
              />
            );
          })}
        </nav>

        <Panel>
          <PanelHeader
            action={
              active && (
                <Badge
                  tone={STAGE_META[active].waitingOn === "you" ? "warn" : "neutral"}
                >
                  {STAGE_META[active].waitingOn === "you"
                    ? "Waiting on you"
                    : STAGE_META[active].waitingOn === "creator"
                      ? "Waiting on the creator"
                      : "Nothing to do"}
                </Badge>
              )
            }
          >
            <PanelTitle>
              {active ? STAGE_META[active].label : "Every deal"}
            </PanelTitle>
          </PanelHeader>

          {active && (
            <PanelBody className="border-b border-line py-3 text-[13px] text-ink-2">
              {STAGE_META[active].blurb}
            </PanelBody>
          )}

          <TableWrap>
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH className="w-[32%]">Creator</TH>
                  <TH className="hidden md:table-cell">Campaign</TH>
                  <TH>Status</TH>
                  <TH numeric>Fee</TH>
                  <TH numeric className="hidden sm:table-cell">
                    Due
                  </TH>
                </TR>
              </THead>
              <TBody>
                {shown.length === 0 ? (
                  <TableEmpty colSpan={5}>
                    {active
                      ? `Nothing in ${STAGE_META[active].label.toLowerCase()} right now.`
                      : "No deals yet. Approve a shortlist to create some."}
                  </TableEmpty>
                ) : (
                  shown.map((deal) => (
                    <TR key={deal.id}>
                      <TD>
                        <Link
                          href={`/deals/${deal.id}`}
                          className="flex items-center gap-3"
                        >
                          <Avatar name={deal.creatorName} />
                          <span className="min-w-0">
                            <CellMain>@{deal.creatorHandle}</CellMain>
                            <CellSub>{deal.creatorName}</CellSub>
                          </span>
                        </Link>
                      </TD>
                      <TD className="hidden md:table-cell">
                        {deal.campaignId ? (
                          <Link href={`/campaigns/${deal.campaignId}`}>
                            <CellMain>{deal.campaignName}</CellMain>
                            <CellSub>{deal.brandName}</CellSub>
                          </Link>
                        ) : (
                          <CellSub>Direct deal</CellSub>
                        )}
                      </TD>
                      <TD>
                        <DealStatusBadge status={deal.status} />
                        {deal.proposedFeeKobo !== null && (
                          <span className="mt-1 block text-[12px] text-warn">
                            asking {formatNaira(deal.proposedFeeKobo)}
                          </span>
                        )}
                      </TD>
                      <TD numeric>
                        <CellMain className="tabular-nums">
                          {formatNaira(deal.feeKobo)}
                        </CellMain>
                      </TD>
                      <TD numeric className="hidden sm:table-cell">
                        <CellSub>{formatRelative(deal.deadline, NOW)}</CellSub>
                      </TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
          </TableWrap>

          <PanelFooter>
            A deal is only ever waiting on one of three things: you, the creator,
            or nothing at all.
          </PanelFooter>
        </Panel>
      </Page>
    </>
  );
}

function StageTab({
  href,
  label,
  count,
  active,
  urgent,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
  urgent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-medium transition-colors sm:py-1.5",
        active
          ? "border-ink bg-ink text-white"
          : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink",
      )}
    >
      {label}
      <span
        className={cn(
          "tabular-nums",
          active ? "text-white/60" : urgent ? "text-warn" : "text-ink-3",
        )}
      >
        {count}
      </span>
    </Link>
  );
}
