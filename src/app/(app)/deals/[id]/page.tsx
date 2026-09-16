import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Check, ExternalLink, FileText, Sparkles, X } from "lucide-react";
import { Topbar } from "@/components/app/topbar";
import { Page, PageHead, StatStrip } from "@/components/app/page-head";
import { RevisionForm } from "./revision-form";
import { ActionButton } from "@/components/app/action-button";
import { DealStatusBadge, ScoreBadge } from "@/components/app/status";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody, PanelFooter, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { env } from "@/lib/env";
import { requireServiceClient } from "@/lib/supabase/service";
import { getCurrentUser, getDeal, NOW } from "@/lib/data/queries";
import type { Draft } from "@/lib/domain";
import { applyBps, formatNaira } from "@/lib/money";
import { cn, formatCount, formatDate, formatPercent, formatRelative } from "@/lib/utils";
import { approveDraft, verifyPublished } from "../../actions";

export const metadata = { title: "Deal" };

/**
 * One deal, from the agency's side.
 *
 * The order is the order the work happens in: who, what they were promised,
 * what they submitted, and the one decision available right now. The money
 * breakdown includes the agency's margin, which is the one number on this
 * screen that must never appear in the client's view of the same deal.
 */
export default async function DealPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [summary, user] = await Promise.all([getDeal(id), getCurrentUser()]);
  if (!summary) notFound();

  const { deal, creator, profile, score, campaignName, endBrandName } = summary;
  const drafts = await draftsFor(deal.id);
  const latest = drafts[0] ?? null;

  const platformFee = applyBps(deal.feeKobo, deal.platformFeeBps);
  const margin = await marginFor(deal.campaignId);
  const marginKobo = margin ? applyBps(deal.feeKobo, margin) : 0;
  const clientCharged = deal.feeKobo + platformFee + marginKobo;

  return (
    <>
      <Topbar
        crumbs={[
          { label: "Campaigns", href: "/campaigns" },
          ...(deal.campaignId
            ? [{ label: campaignName ?? "Campaign", href: `/campaigns/${deal.campaignId}` }]
            : []),
          { label: `@${creator.handle}` },
        ]}
        userName={user.name}
      />
      <Page>
        <PageHead
          kicker={`${endBrandName ?? "Own deal"}${campaignName ? ` · ${campaignName}` : ""}`}
          title={`@${creator.handle}`}
          subtitle={
            <span className="flex flex-wrap items-center gap-2">
              <span>
                {creator.displayName} · {profile?.locationCity} ·{" "}
                {formatCount(profile?.followers ?? 0)} followers ·{" "}
                {formatPercent(profile?.engagementRate ?? 0)} engagement
              </span>
              {score && <ScoreBadge score={score.fraudScore} />}
            </span>
          }
          actions={<DealStatusBadge status={deal.status} />}
        />

        <StatStrip
          items={[
            {
              label: "Creator fee",
              value: formatNaira(deal.feeKobo),
              note: "What they receive",
            },
            {
              label: "Charged to the client",
              value: formatNaira(clientCharged),
              note: margin
                ? `includes your ${margin / 100}% margin`
                : `includes the ${deal.platformFeeBps / 100}% platform fee`,
            },
            {
              label: "Due",
              value: formatDate(deal.deadline, NOW),
              note: formatRelative(deal.deadline, NOW),
            },
          ]}
        />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div className="space-y-4">
            {/* What they submitted, and the check it went through. */}
            {latest ? (
              <Panel accent={deal.status === "draft_submitted"}>
                <PanelHeader
                  action={
                    <span className="text-[12.5px] text-ink-3">
                      v{latest.version} · {formatRelative(latest.submittedAt, NOW)}
                    </span>
                  }
                >
                  <PanelTitle>Submitted content</PanelTitle>
                </PanelHeader>
                <PanelBody className="grid gap-5 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
                  <div>
                    <div className="grid aspect-[9/16] max-h-56 place-items-center rounded-[var(--radius-md)] bg-chrome text-[12.5px] text-white/50">
                      video
                    </div>
                    <p className="mt-3 text-[13px] leading-relaxed text-ink-2">
                      {latest.caption}
                    </p>
                  </div>

                  <div className="min-w-0">
                    {latest.aiReview ? (
                      <>
                        <div
                          className={cn(
                            "mb-3 flex items-start gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-[13px] font-medium",
                            latest.aiReview.passes
                              ? "bg-ok-soft text-ok"
                              : "bg-warn-soft text-warn",
                          )}
                        >
                          <Sparkles className="mt-0.5 size-4 shrink-0" />
                          {latest.aiReview.passes
                            ? "Passed every check against your brief"
                            : "Sent back to the creator before it reached you"}
                        </div>
                        <ul className="divide-y divide-line">
                          {latest.aiReview.checks.map((check) => {
                            const Icon =
                              check.status === "pass"
                                ? Check
                                : check.status === "fail"
                                  ? X
                                  : AlertTriangle;
                            return (
                              <li key={check.id} className="flex gap-2.5 py-2">
                                <Icon
                                  className={cn(
                                    "mt-0.5 size-4 shrink-0",
                                    check.status === "pass"
                                      ? "text-ok"
                                      : check.status === "fail"
                                        ? "text-danger"
                                        : "text-warn",
                                  )}
                                />
                                <span className="min-w-0">
                                  <span className="block text-[13.5px]">
                                    {check.label}
                                  </span>
                                  {check.evidence && (
                                    <span className="block text-[12.5px] text-ink-3">
                                      {check.evidence}
                                    </span>
                                  )}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </>
                    ) : (
                      <p className="text-[13px] text-ink-3">Still being checked.</p>
                    )}

                    {deal.status === "draft_submitted" && (
                      <div className="mt-4 flex flex-wrap items-start gap-2">
                        <ActionButton
                          action={approveDraft.bind(null, latest.id, undefined)}
                          variant="default"
                        >
                          <Check /> Approve
                        </ActionButton>
                        <RevisionForm draftId={latest.id} />
                      </div>
                    )}
                  </div>
                </PanelBody>
              </Panel>
            ) : (
              <Panel>
                <PanelBody className="py-12 text-center text-[13px] text-ink-3">
                  Nothing submitted yet.
                </PanelBody>
              </Panel>
            )}

            {/* Publishing and payment. */}
            <Panel accent={deal.status === "published"}>
              <PanelHeader>
                <PanelTitle>Published and paid</PanelTitle>
              </PanelHeader>
              <PanelBody className="space-y-3 text-[13.5px]">
                {deal.publishedUrl ? (
                  <>
                    <a
                      href={deal.publishedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 break-all text-brand-ink hover:underline"
                    >
                      {deal.publishedUrl} <ExternalLink className="size-3.5 shrink-0" />
                    </a>
                    <p className="text-ink-2">
                      Posted {deal.publishedAt ? formatRelative(deal.publishedAt, NOW) : "—"}.
                    </p>
                    {deal.status === "published" && (
                      <div className="pt-1">
                        <ActionButton
                          action={verifyPublished.bind(null, deal.id)}
                          variant="brand"
                          confirm={`Release ${formatNaira(deal.feeKobo)} to ${creator.displayName}? Check the post is live first — this pays out.`}
                        >
                          I checked the post — release {formatNaira(deal.feeKobo)}
                        </ActionButton>
                      </div>
                    )}
                    {deal.status === "paid" && (
                      <Badge tone="ok" dot>
                        Released to the creator
                      </Badge>
                    )}
                  </>
                ) : (
                  <p className="text-ink-3">
                    The creator has not added the published link yet. Payment releases
                    once they do and you have checked the post is live.
                  </p>
                )}
              </PanelBody>
              <PanelFooter>
                Verification is a person looking at the post, not an automated
                scrape. Paying out on an unverified claim is the exact failure
                escrow exists to prevent.
              </PanelFooter>
            </Panel>
          </div>

          {/* The money, in full — agency side only. */}
          <Panel className="lg:sticky lg:top-20">
            <PanelHeader>
              <PanelTitle>The money</PanelTitle>
            </PanelHeader>
            <PanelBody className="space-y-2.5 text-[13.5px]">
              <MoneyRow label="Creator fee" value={formatNaira(deal.feeKobo)} />
              {margin ? (
                <MoneyRow
                  label={`Your margin · ${margin / 100}%`}
                  value={formatNaira(marginKobo)}
                  note="Never shown to the client"
                />
              ) : null}
              <MoneyRow
                label={`SubSquad fee · ${deal.platformFeeBps / 100}%`}
                value={formatNaira(platformFee)}
              />
              <div className="border-t border-ink pt-2.5">
                <MoneyRow
                  label="Charged to the client"
                  value={formatNaira(clientCharged)}
                  strong
                />
              </div>
            </PanelBody>
            <PanelFooter>
              <Link
                href="#"
                className="inline-flex items-center gap-1.5 font-medium text-brand-ink hover:underline"
              >
                <FileText className="size-3.5" />
                {deal.contractAcceptedAt
                  ? `Contract signed ${formatDate(deal.contractAcceptedAt, NOW)}`
                  : "Contract not signed yet"}
              </Link>
            </PanelFooter>
          </Panel>
        </div>

        <div className="mt-4 flex items-center gap-3 text-[12.5px] text-ink-3">
          <Avatar name={creator.displayName} size="sm" />
          Invite link: /i/{deal.inviteToken}
        </div>
      </Page>
    </>
  );
}

function MoneyRow({
  label,
  value,
  note,
  strong,
}: {
  label: string;
  value: string;
  note?: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className={strong ? "font-medium" : "text-ink-2"}>
        {label}
        {note && <span className="block text-[12px] text-ink-3">{note}</span>}
      </span>
      <span
        className={cn("shrink-0 tabular-nums", strong && "text-[18px] font-semibold")}
      >
        {value}
      </span>
    </div>
  );
}

async function draftsFor(dealId: string): Promise<Draft[]> {
  if (env.demoMode) {
    const { DEMO_DRAFTS } = await import("@/lib/demo/data");
    return DEMO_DRAFTS.filter((d) => d.dealId === dealId).sort(
      (a, b) => b.version - a.version,
    );
  }
  const { data } = await requireServiceClient()
    .from("drafts")
    .select("*")
    .eq("deal_id", dealId)
    .order("version", { ascending: false });
  return (data ?? []).map((d) => ({
    id: d.id,
    dealId: d.deal_id,
    version: Number(d.version),
    fileUrl: d.file_url,
    caption: d.caption ?? "",
    submittedAt: d.submitted_at,
    aiReview: d.ai_review,
    reviewerDecision: d.reviewer_decision,
    reviewerNotes: d.reviewer_notes,
  }));
}

async function marginFor(campaignId: string | null): Promise<number | null> {
  if (!campaignId) return null;
  if (env.demoMode) {
    const { DEMO_CAMPAIGNS } = await import("@/lib/demo/data");
    return DEMO_CAMPAIGNS.find((c) => c.id === campaignId)?.agencyMarginBps ?? null;
  }
  const { data } = await requireServiceClient()
    .from("campaigns")
    .select("agency_margin_bps")
    .eq("id", campaignId)
    .maybeSingle();
  return data?.agency_margin_bps ?? null;
}
