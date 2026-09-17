import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ExternalLink, TrendingUp } from "lucide-react";
import { Topbar } from "@/components/app/topbar";
import { Page, PageHead, StatStrip } from "@/components/app/page-head";
import { DealStatusBadge, ScoreBadge } from "@/components/app/status";
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
import { getCreatorDetail, getCurrentUser, NOW } from "@/lib/data/queries";
import { formatNaira } from "@/lib/money";
import { cn, formatCount, formatDate, formatPercent } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getCreatorDetail(id);
  return { title: detail ? `@${detail.creator.handle}` : "Creator" };
}

/**
 * One creator, in full.
 *
 * The shortlist used to end at a paragraph of AI reasoning — a recommendation
 * with no way to check it. An agency about to commit a client's ₦200,000 needs
 * the numbers the recommendation was made from, the work itself, and the record
 * of whether this person delivers.
 *
 * Deliberately not a vanity page: the fraud score's deductions are shown with
 * their evidence, and a missed deadline is as prominent as a completed deal.
 * A directory that only flatters is one nobody can make a decision from.
 */
export default async function CreatorProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [detail, user] = await Promise.all([
    getCreatorDetail(id),
    getCurrentUser(),
  ]);
  if (!detail) notFound();

  const { creator, profile, score, history, record } = detail;

  // Followers mean little on their own; what a brand is buying is views.
  const followerToView =
    profile && profile.followers > 0 ? profile.avgViews / profile.followers : null;

  return (
    <>
      <Topbar
        crumbs={[
          { label: "Creators", href: "/creators" },
          { label: `@${creator.handle}` },
        ]}
        userName={user.name}
      />
      <Page>
        <div className="flex flex-wrap items-start gap-4">
          <Avatar name={creator.displayName} size="lg" />
          <div className="min-w-0 flex-1">
            <PageHead
              kicker={[
                profile?.platform === "tiktok" ? "TikTok" : "Instagram",
                profile?.locationCity,
                profile?.languages?.join(", "),
              ]
                .filter(Boolean)
                .join(" · ")}
              title={`@${creator.handle}`}
              subtitle={creator.displayName}
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  {score && <ScoreBadge score={score.fraudScore} />}
                  <Badge tone={creator.status === "onboarded" ? "ok" : "neutral"}>
                    {creator.status}
                  </Badge>
                </div>
              }
            />
          </div>
        </div>

        <StatStrip
          items={[
            {
              label: "Followers",
              value: formatCount(profile?.followers ?? 0),
              note: profile
                ? `${formatCount(profile.postsCount)} posts · follows ${formatCount(profile.following)}`
                : "No profile fetched yet",
            },
            {
              label: "Average views",
              value: formatCount(profile?.avgViews ?? 0),
              note:
                followerToView !== null
                  ? `${formatPercent(followerToView)} of followers see a post`
                  : "—",
            },
            {
              label: "Engagement",
              value: formatPercent(profile?.engagementRate ?? 0),
              note: profile
                ? `${formatCount(profile.avgLikes)} likes · ${formatCount(profile.avgComments)} comments`
                : "—",
            },
            {
              label: "Delivered for you",
              value: `${record.completed}`,
              note:
                record.missed > 0
                  ? `${record.missed} cancelled · ${record.onTime} on time`
                  : record.completed > 0
                    ? `${record.onTime} of ${record.completed} on time`
                    : "No completed deals yet",
              tone: record.missed > 0 ? "warn" : "ok",
            },
          ]}
        />

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div className="space-y-5">
            {/* Recent work — the thing a paragraph of reasoning cannot replace. */}
            <Panel>
              <PanelHeader>
                <PanelTitle>Recent posts</PanelTitle>
              </PanelHeader>
              {profile?.samplePosts?.length ? (
                <ul className="divide-y divide-line">
                  {profile.samplePosts.map((post) => (
                    <li key={post.url} className="px-5 py-4">
                      <p className="text-[13.5px] leading-relaxed text-ink-2">
                        {post.caption}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-ink-3">
                        <span className="tabular-nums">
                          {formatCount(post.views)} views
                        </span>
                        <span className="tabular-nums">
                          {formatCount(post.likes)} likes
                        </span>
                        {post.url && (
                          <a
                            href={post.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 font-medium text-brand-ink hover:underline"
                          >
                            Open <ExternalLink className="size-3.5" />
                          </a>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <PanelBody className="text-[13.5px] text-ink-3">
                  No sample posts have been fetched for this creator yet.
                </PanelBody>
              )}
            </Panel>

            {/* Their history with this org only. */}
            <Panel>
              <PanelHeader>
                <PanelTitle>Deals with you</PanelTitle>
              </PanelHeader>
              <TableWrap>
                <Table>
                  <THead>
                    <TR className="hover:bg-transparent">
                      <TH>Campaign</TH>
                      <TH>Status</TH>
                      <TH numeric>Fee</TH>
                      <TH numeric className="hidden sm:table-cell">
                        Published
                      </TH>
                    </TR>
                  </THead>
                  <TBody>
                    {history.length === 0 ? (
                      <TableEmpty colSpan={4}>
                        You have not worked with this creator yet.
                      </TableEmpty>
                    ) : (
                      history.map((deal) => (
                        <TR key={deal.id}>
                          <TD>
                            <Link href={`/deals/${deal.id}`}>
                              <CellMain>{deal.campaignName}</CellMain>
                              {deal.brandName && (
                                <CellSub>{deal.brandName}</CellSub>
                              )}
                            </Link>
                          </TD>
                          <TD>
                            <DealStatusBadge status={deal.status} />
                          </TD>
                          <TD numeric>
                            <CellMain className="tabular-nums">
                              {formatNaira(deal.feeKobo)}
                            </CellMain>
                          </TD>
                          <TD numeric className="hidden sm:table-cell">
                            <CellSub>
                              {deal.publishedAt
                                ? formatDate(deal.publishedAt, NOW)
                                : "—"}
                            </CellSub>
                          </TD>
                        </TR>
                      ))
                    )}
                  </TBody>
                </Table>
              </TableWrap>
              <PanelFooter>
                You only see deals on your own account. What this creator does
                for other agencies is not shown to you, and yours is not shown to
                them.
              </PanelFooter>
            </Panel>
          </div>

          {/* How the score was arrived at. */}
          <div className="space-y-5">
            <Panel>
              <PanelHeader
                action={score ? <ScoreBadge score={score.fraudScore} /> : null}
              >
                <PanelTitle>How this score was reached</PanelTitle>
              </PanelHeader>
              {score?.reasons?.length ? (
                <ul className="divide-y divide-line">
                  {score.reasons.map((reason) => (
                    <li key={reason.id} className="px-5 py-3.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[13px] font-medium">
                          {reason.label}
                        </span>
                        <span
                          className={cn(
                            "shrink-0 text-[13px] font-semibold tabular-nums",
                            reason.delta < 0 ? "text-warn" : "text-ok",
                          )}
                        >
                          {reason.delta}
                        </span>
                      </div>
                      <p className="mt-1 text-[12.5px] leading-relaxed text-ink-3">
                        {reason.evidence}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <PanelBody className="flex gap-2 text-[13px] leading-relaxed text-ink-2">
                  <TrendingUp className="mt-0.5 size-4 shrink-0 text-ok" />
                  Nothing was deducted. Follower growth, engagement and comment
                  patterns all looked normal.
                </PanelBody>
              )}
              <PanelFooter>
                Every creator starts at 100 and loses points for specific,
                evidenced signals. Below {60} they are never shortlisted.
              </PanelFooter>
            </Panel>

            {profile?.categoryTags?.length ? (
              <Panel>
                <PanelHeader>
                  <PanelTitle>What they post about</PanelTitle>
                </PanelHeader>
                <PanelBody className="flex flex-wrap gap-2">
                  {profile.categoryTags.map((tag) => (
                    <Badge key={tag} tone="neutral">
                      {tag}
                    </Badge>
                  ))}
                </PanelBody>
              </Panel>
            ) : null}

            {creator.doNotContact && (
              <Panel>
                <PanelBody className="flex gap-2 text-[13px] leading-relaxed text-danger">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  This creator has asked not to be contacted. They will never
                  appear in a shortlist.
                </PanelBody>
              </Panel>
            )}
          </div>
        </div>
      </Page>
    </>
  );
}
