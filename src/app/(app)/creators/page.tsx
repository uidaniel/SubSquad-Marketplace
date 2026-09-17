import Link from "next/link";
import { Upload } from "lucide-react";
import { Topbar } from "@/components/app/topbar";
import { Page, PageHead } from "@/components/app/page-head";
import { ScoreBadge } from "@/components/app/status";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
import { getCreators, getCurrentUser } from "@/lib/data/queries";
import { SHORTLIST_ELIGIBILITY_THRESHOLD } from "@/lib/fraud/rules";
import { formatNaira } from "@/lib/money";
import { cn, formatCount, formatPercent } from "@/lib/utils";

export const metadata = { title: "Creators" };

export default async function CreatorsPage() {
  const [user, creators] = await Promise.all([getCurrentUser(), getCreators()]);

  const eligible = creators.filter(
    (c) => (c.score?.fraudScore ?? 0) >= SHORTLIST_ELIGIBILITY_THRESHOLD,
  );
  const onboarded = creators.filter((c) => c.creator.status === "onboarded");

  return (
    <>
      <Topbar crumbs={[{ label: "Creators" }]} userName={user.name} />
      <Page>
        <PageHead
          title="Creators"
          subtitle={
            <>
              {creators.length} indexed · {eligible.length} above the fraud threshold ·{" "}
              {onboarded.length} onboarded with a verified payout account
            </>
          }
          actions={
            <Button variant="outline" asChild>
              <Link href="/ops/import">
                <Upload /> Import creators
              </Link>
            </Button>
          }
        />

        <Panel>
          <PanelHeader>
            <PanelTitle>The index</PanelTitle>
          </PanelHeader>
          <TableWrap>
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH className="w-[26%]">Creator</TH>
                  <TH numeric className="hidden sm:table-cell">Followers</TH>
                  <TH numeric className="hidden lg:table-cell">Engagement</TH>
                  <TH>Score</TH>
                  <TH className="hidden md:table-cell">Status</TH>
                  <TH numeric className="hidden xl:table-cell">Deals</TH>
                  <TH numeric>Earned here</TH>
                </TR>
              </THead>
              <TBody>
                {creators.length === 0 ? (
                  <TableEmpty colSpan={7}>
                    No creators indexed yet. Import a CSV to get started.
                  </TableEmpty>
                ) : (
                  creators.map(({ creator, profile, score, dealsCount, earnedKobo }) => {
                    const excluded =
                      (score?.fraudScore ?? 0) < SHORTLIST_ELIGIBILITY_THRESHOLD;
                    return (
                      <TR key={creator.id} className={cn(excluded && "opacity-60")}>
                        <TD>
                          <Link
                            href={`/creators/${creator.id}`}
                            className="flex items-center gap-3"
                          >
                            <Avatar name={creator.displayName} />
                            <span className="min-w-0">
                              <CellMain>@{creator.handle}</CellMain>
                              <CellSub>
                                {creator.displayName} · {profile?.locationCity}
                              </CellSub>
                            </span>
                          </Link>
                        </TD>
                        <TD numeric className="hidden sm:table-cell">
                          {formatCount(profile?.followers ?? 0)}
                        </TD>
                        <TD numeric className="hidden lg:table-cell">
                          {formatPercent(profile?.engagementRate ?? 0)}
                        </TD>
                        <TD>
                          {score && (
                            <div className="flex flex-col items-start gap-1">
                              <ScoreBadge score={score.fraudScore} />
                              {score.reasons.length > 0 && (
                                <span className="text-[12px] text-ink-3">
                                  {score.reasons[0].label}
                                </span>
                              )}
                            </div>
                          )}
                        </TD>
                        <TD className="hidden md:table-cell">
                          <Badge
                            tone={
                              creator.status === "onboarded"
                                ? "ok"
                                : creator.status === "suspended"
                                  ? "danger"
                                  : "neutral"
                            }
                          >
                            {creator.status}
                          </Badge>
                        </TD>
                        <TD numeric className="hidden xl:table-cell">{dealsCount || "—"}</TD>
                        <TD numeric>
                          <span
                            className={cn(
                              "tabular-nums",
                              earnedKobo > 0 ? "text-ok" : "text-ink-3",
                            )}
                          >
                            {earnedKobo > 0 ? formatNaira(earnedKobo) : "—"}
                          </span>
                        </TD>
                      </TR>
                    );
                  })
                )}
              </TBody>
            </Table>
          </TableWrap>
          <PanelFooter>
            Creators scoring below {SHORTLIST_ELIGIBILITY_THRESHOLD} never reach a
            shortlist. They stay visible here so the exclusion can be checked — and
            appealed.
          </PanelFooter>
        </Panel>
      </Page>
    </>
  );
}
