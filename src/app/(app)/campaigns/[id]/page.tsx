import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  Check,
  ExternalLink,
  FileText,
  Sparkles,
  X,
} from "lucide-react";
import { Topbar } from "@/components/app/topbar";
import { Page, PageHead, StatStrip } from "@/components/app/page-head";
import { Tabs } from "@/components/app/tabs";
import { CampaignStatusBadge, DealStatusBadge, ScoreBadge } from "@/components/app/status";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  getCampaignSummary,
  getCurrentUser,
  getDealsForCampaign,
  getDraftsForCampaign,
  getMessagesForCampaign,
  NOW,
} from "@/lib/data/queries";
import type { AiReview, DealSummary } from "@/lib/domain";
import { formatNaira } from "@/lib/money";
import { cn, formatDate, formatRelative } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const summary = await getCampaignSummary(id);
  return { title: summary?.campaign.name ?? "Campaign" };
}

const TAB_KEYS = ["creators", "content", "messages", "results", "contract"] as const;
type TabKey = (typeof TAB_KEYS)[number];

export default async function CampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  const [summary, user] = await Promise.all([getCampaignSummary(id), getCurrentUser()]);
  if (!summary) notFound();

  const { campaign } = summary;
  const [deals, drafts, messages] = await Promise.all([
    getDealsForCampaign(id),
    getDraftsForCampaign(id),
    getMessagesForCampaign(id),
  ]);

  const active: TabKey = TAB_KEYS.includes(tab as TabKey)
    ? (tab as TabKey)
    : "creators";

  const pendingDrafts = messages.filter((m) => m.message.aiDraft && !m.message.sentAt);
  const awaitingReview = drafts.filter(
    (d) => d.deal.deal.status === "draft_submitted",
  );
  const published = deals.filter(
    (d) => d.deal.status === "published" || d.deal.status === "paid",
  );

  return (
    <>
      <Topbar
        crumbs={[
          { label: "Campaigns", href: "/campaigns" },
          { label: campaign.name },
        ]}
        userName={user.name}
      />
      <Page>
        <PageHead
          kicker={`${summary.spaceName} · ends ${formatDate(campaign.deadline, NOW)}`}
          title={campaign.name}
          subtitle={campaign.brief.product}
          actions={
            <>
              <CampaignStatusBadge status={campaign.status} />
              {summary.nextAction && (
                <Button variant="brand" asChild>
                  <Link href={summary.nextAction.href}>
                    {summary.nextAction.label}
                  </Link>
                </Button>
              )}
            </>
          }
        />

        <StatStrip
          items={[
            {
              label: "Held in escrow",
              value: formatNaira(summary.escrowHeldKobo),
              note: `of ${formatNaira(campaign.budgetKobo)} funded`,
            },
            {
              label: "Creators confirmed",
              value: `${summary.creatorsConfirmed} of ${summary.creatorsTarget}`,
              note:
                deals.length > summary.creatorsConfirmed
                  ? `${deals.length - summary.creatorsConfirmed} still in progress`
                  : "All signed",
            },
            {
              label: "Paid to creators",
              value: formatNaira(summary.paidOutKobo),
              note: `${published.length} published`,
              tone: "ok",
            },
          ]}
        />

        <Tabs
          basePath={`/campaigns/${campaign.id}`}
          active={active}
          tabs={[
            { key: "creators", label: "Creators", count: deals.length },
            { key: "content", label: "Content", count: awaitingReview.length },
            { key: "messages", label: "Messages", count: pendingDrafts.length },
            { key: "results", label: "Results", count: published.length },
            { key: "contract", label: "Contract" },
          ]}
        />

        {active === "creators" && <CreatorsTab deals={deals} />}
        {active === "content" && <ContentTab drafts={drafts} />}
        {active === "messages" && <MessagesTab messages={messages} />}
        {active === "results" && <ResultsTab deals={published} />}
        {active === "contract" && <ContractTab campaign={campaign} />}
      </Page>
    </>
  );
}

/* ==========================================================================
   Creators
   ========================================================================== */

function CreatorsTab({ deals }: { deals: DealSummary[] }) {
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Creators on this campaign</PanelTitle>
      </PanelHeader>
      <TableWrap>
        <Table>
          <THead>
            <TR className="hover:bg-transparent">
              <TH className="w-[30%]">Creator</TH>
              <TH>Status</TH>
              <TH>Score</TH>
              <TH numeric>Fee</TH>
              <TH numeric>Due</TH>
            </TR>
          </THead>
          <TBody>
            {deals.length === 0 ? (
              <TableEmpty colSpan={5}>
                Nobody has been invited yet. Approve a shortlist to start.
              </TableEmpty>
            ) : (
              deals.map(({ deal, creator, profile, score }) => (
                <TR key={deal.id}>
                  <TD>
                    <Link href={`/deals/${deal.id}`} className="flex items-center gap-3">
                      <Avatar name={creator.displayName} />
                      <span className="min-w-0">
                        <CellMain>@{creator.handle}</CellMain>
                        <CellSub>
                          {profile?.platform === "tiktok" ? "TikTok" : "Instagram"} ·{" "}
                          {profile?.locationCity}
                        </CellSub>
                      </span>
                    </Link>
                  </TD>
                  <TD>
                    <DealStatusBadge status={deal.status} />
                  </TD>
                  <TD>{score && <ScoreBadge score={score.fraudScore} />}</TD>
                  <TD numeric>
                    <CellMain className="tabular-nums">
                      {formatNaira(deal.feeKobo)}
                    </CellMain>
                  </TD>
                  <TD numeric>
                    <CellSub>{formatRelative(deal.deadline, NOW)}</CellSub>
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      </TableWrap>
    </Panel>
  );
}

/* ==========================================================================
   Content — the AI checklist
   ========================================================================== */

function CheckRow({ check }: { check: AiReview["checks"][number] }) {
  const Icon =
    check.status === "pass" ? Check : check.status === "fail" ? X : AlertTriangle;
  const tone =
    check.status === "pass"
      ? "text-ok"
      : check.status === "fail"
        ? "text-danger"
        : "text-warn";
  return (
    <li className="flex gap-2.5 py-2">
      <Icon className={cn("mt-0.5 size-4 shrink-0", tone)} />
      <span className="min-w-0">
        <span className="block text-[13.5px]">{check.label}</span>
        {check.evidence && (
          <span className="block text-[12.5px] text-ink-3">{check.evidence}</span>
        )}
      </span>
    </li>
  );
}

function ContentTab({
  drafts,
}: {
  drafts: { draft: import("@/lib/domain").Draft; deal: DealSummary }[];
}) {
  if (drafts.length === 0) {
    return (
      <Panel>
        <PanelBody className="py-12 text-center text-[13px] text-ink-3">
          No drafts submitted yet.
        </PanelBody>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      {drafts.map(({ draft, deal }) => {
        const review = draft.aiReview;
        const needsYou = deal.deal.status === "draft_submitted";
        return (
          <Panel key={draft.id} accent={needsYou}>
            <PanelHeader
              action={
                <div className="flex items-center gap-2">
                  <DealStatusBadge status={deal.deal.status} />
                  <span className="text-[12.5px] text-ink-3">
                    v{draft.version} · {formatRelative(draft.submittedAt, NOW)}
                  </span>
                </div>
              }
            >
              <div className="flex items-center gap-2.5">
                <Avatar name={deal.creator.displayName} size="sm" />
                <PanelTitle>@{deal.creator.handle}</PanelTitle>
              </div>
            </PanelHeader>

            <PanelBody className="grid gap-5 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
              <div>
                <div className="grid aspect-[9/16] max-h-64 place-items-center rounded-[var(--radius-md)] bg-chrome text-[12.5px] text-white/50">
                  0:34 · video
                </div>
                <p className="mt-3 text-[13px] leading-relaxed text-ink-2">
                  {draft.caption}
                </p>
              </div>

              <div className="min-w-0">
                {review ? (
                  <>
                    <div
                      className={cn(
                        "mb-3 flex items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-[13px] font-medium",
                        review.passes
                          ? "bg-ok-soft text-ok"
                          : "bg-warn-soft text-warn",
                      )}
                    >
                      <Sparkles className="size-4" />
                      {review.passes
                        ? "Passed every check against your brief"
                        : "Sent back to the creator — you did not need to see this yet"}
                    </div>

                    <ul className="divide-y divide-line">
                      {review.checks.map((check) => (
                        <CheckRow key={check.id} check={check} />
                      ))}
                    </ul>

                    {!review.passes && (
                      <details className="mt-3 rounded-[var(--radius-sm)] bg-surface-2 px-3 py-2.5">
                        <summary className="cursor-pointer text-[12.5px] font-medium text-ink-2">
                          What the creator was told
                        </summary>
                        <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-ink-2">
                          {review.creatorFeedback}
                        </p>
                      </details>
                    )}
                  </>
                ) : (
                  <p className="text-[13px] text-ink-3">
                    This draft is still being checked.
                  </p>
                )}

                {needsYou && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="default">
                      <Check /> Approve
                    </Button>
                    <Button variant="outline">Request a revision</Button>
                  </div>
                )}
              </div>
            </PanelBody>
          </Panel>
        );
      })}
    </div>
  );
}

/* ==========================================================================
   Messages — the approval queue
   ========================================================================== */

function MessagesTab({
  messages,
}: {
  messages: { message: import("@/lib/domain").DealMessage; deal: DealSummary }[];
}) {
  if (messages.length === 0) {
    return (
      <Panel>
        <PanelBody className="py-12 text-center text-[13px] text-ink-3">
          No messages yet.
        </PanelBody>
      </Panel>
    );
  }

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Conversation</PanelTitle>
      </PanelHeader>
      <ul className="divide-y divide-line">
        {messages.map(({ message, deal }) => {
          const pending = message.aiDraft && !message.sentAt;
          return (
            <li key={message.id} className={cn("px-5 py-4", pending && "bg-warn-soft/40")}>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Avatar name={deal.creator.displayName} size="sm" />
                <span className="text-[13px] font-medium">@{deal.creator.handle}</span>
                <Badge tone={message.direction === "inbound" ? "neutral" : "info"}>
                  {message.direction === "inbound" ? "From creator" : "To creator"}
                </Badge>
                <Badge tone="neutral">{message.channel}</Badge>
                {pending && (
                  <Badge tone="warn" dot>
                    Drafted by AI — not sent
                  </Badge>
                )}
                <span className="ml-auto text-[12px] text-ink-3">
                  {formatRelative(message.sentAt ?? message.createdAt, NOW)}
                </span>
              </div>

              <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-ink-2">
                {message.body}
              </p>

              {pending ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="default">
                    <Check /> Approve and send
                  </Button>
                  <Button size="sm" variant="outline">
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost">
                    Discard
                  </Button>
                </div>
              ) : message.approvedBy ? (
                <p className="mt-2 text-[12px] text-ink-3">
                  Approved by {message.approvedBy}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
      <PanelFooter>
        Nothing here sends on its own. Every outbound message waits for a person.
      </PanelFooter>
    </Panel>
  );
}

/* ==========================================================================
   Results
   ========================================================================== */

function ResultsTab({ deals }: { deals: DealSummary[] }) {
  const total = deals.reduce((s, d) => s + d.deal.feeKobo, 0);

  return (
    <Panel>
      <PanelHeader
        action={
          <Button variant="outline" size="sm">
            Export report
          </Button>
        }
      >
        <PanelTitle>Published content</PanelTitle>
      </PanelHeader>
      <TableWrap>
        <Table>
          <THead>
            <TR className="hover:bg-transparent">
              <TH>Creator</TH>
              <TH>Published</TH>
              <TH numeric>Fee</TH>
              <TH numeric>Status</TH>
            </TR>
          </THead>
          <TBody>
            {deals.length === 0 ? (
              <TableEmpty colSpan={4}>Nothing published yet.</TableEmpty>
            ) : (
              deals.map(({ deal, creator }) => (
                <TR key={deal.id}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <Avatar name={creator.displayName} size="sm" />
                      <CellMain>@{creator.handle}</CellMain>
                    </div>
                  </TD>
                  <TD>
                    {deal.publishedUrl ? (
                      <a
                        href={deal.publishedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-[13px] text-brand-ink hover:underline"
                      >
                        View post <ExternalLink className="size-3.5" />
                      </a>
                    ) : (
                      <CellSub>—</CellSub>
                    )}
                    <CellSub>
                      {deal.publishedAt ? formatRelative(deal.publishedAt, NOW) : ""}
                    </CellSub>
                  </TD>
                  <TD numeric>
                    <CellMain className="tabular-nums">
                      {formatNaira(deal.feeKobo)}
                    </CellMain>
                  </TD>
                  <TD numeric>
                    <DealStatusBadge status={deal.status} />
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      </TableWrap>
      {deals.length > 0 && (
        <PanelFooter>
          <span className="tabular-nums">
            {deals.length} published · {formatNaira(total)} released to creators
          </span>
        </PanelFooter>
      )}
    </Panel>
  );
}

/* ==========================================================================
   Contract and brief
   ========================================================================== */

function ContractTab({ campaign }: { campaign: import("@/lib/domain").Campaign }) {
  const { brief } = campaign;
  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      <Panel>
        <PanelHeader>
          <PanelTitle>The brief</PanelTitle>
        </PanelHeader>
        <PanelBody className="space-y-4 text-[13.5px]">
          <Field label="Objective" value={brief.objective} />
          <Field label="Product" value={brief.product} />
          <ListField label="Key messages" items={brief.keyMessages} />
          <ListField label="Must include" items={brief.mustInclude} />
          <ListField label="Must avoid" items={brief.mustAvoid} tone="danger" />
          <Field
            label="Audience"
            value={`${brief.audience.ageRange[0]}–${brief.audience.ageRange[1]} · ${brief.audience.cities.join(
              ", ",
            )} · ${brief.audience.languages.join(", ")}`}
          />
          <Field label="Tone" value={brief.tone} />
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>Terms on every deal</PanelTitle>
        </PanelHeader>
        <PanelBody className="space-y-3 text-[13.5px]">
          <Row label="Disclosure tag" value={brief.disclosureTag} />
          <Row label="ARCON category" value={brief.arconCategory} />
          <Row label="Usage rights" value={`${brief.usageRightsDays} days organic`} />
          <Row label="SubSquad fee" value={`${campaign.platformFeeBps / 100}%`} />
          {campaign.agencyMarginBps !== null && (
            <Row
              label="Your margin"
              value={`${campaign.agencyMarginBps / 100}%`}
              note="Never shown to the client"
            />
          )}
          <Row
            label="Rate band"
            value={`${formatNaira(campaign.rateBandMinKobo)} – ${formatNaira(
              campaign.rateBandMaxKobo,
            )}`}
            note="The AI negotiates inside this and never above it"
          />
        </PanelBody>
        <PanelFooter>
          <Link
            href="#"
            className="inline-flex items-center gap-1.5 font-medium text-brand-ink hover:underline"
          >
            <FileText className="size-3.5" /> Read the creator agreement
          </Link>
        </PanelFooter>
      </Panel>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.04em] text-ink-3">{label}</p>
      <p className="mt-0.5 capitalize">{value}</p>
    </div>
  );
}

function ListField({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone?: "danger";
}) {
  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.04em] text-ink-3">{label}</p>
      <ul className="mt-1 space-y-1">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            {tone === "danger" ? (
              <X className="mt-0.5 size-3.5 shrink-0 text-danger" />
            ) : (
              <Check className="mt-0.5 size-3.5 shrink-0 text-ok" />
            )}
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Row({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line pb-2.5 last:border-0">
      <span className="text-ink-2">{label}</span>
      <span className="text-right">
        <span className="block font-medium capitalize tabular-nums">{value}</span>
        {note && <span className="block text-[12px] text-ink-3">{note}</span>}
      </span>
    </div>
  );
}
