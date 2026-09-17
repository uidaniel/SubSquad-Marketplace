"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Sparkles, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Panel,
  PanelBody,
  PanelFooter,
  PanelHeader,
  PanelTitle,
} from "@/components/ui/panel";
import { ScoreBadge } from "@/components/app/status";
import { ActionButton } from "@/components/app/action-button";
import { approveShortlist } from "../../../actions";
import { GenerateShortlistButton } from "./generate-button";
import type { Creator, CreatorProfile, CreatorScoreRecord, ShortlistItem } from "@/lib/domain";
import { formatNaira } from "@/lib/money";
import { cn, formatCount, formatPercent } from "@/lib/utils";

export interface ShortlistRow {
  item: ShortlistItem;
  creator: Creator;
  profile: CreatorProfile | null;
  score: CreatorScoreRecord | null;
}

/**
 * Shortlist review.
 *
 * The spec asks for cards with approve and remove on each. Two things are added
 * here because approving a shortlist is the moment money gets committed:
 *
 *  1. A running total. Each approval commits a fee plus the platform fee on top,
 *     and the person approving should see the escrow draw down as they go
 *     rather than discover the total on the next screen.
 *  2. Default-on selection. The AI has already ranked and excluded; asking a
 *     person to tick twenty boxes to agree with it is make-work. They start
 *     approved and you remove the ones you disagree with — which is also the
 *     honest framing, since the AI has done the work either way.
 */
export function ShortlistReview({
  rows,
  escrowAvailableKobo,
  platformFeeBps,
  campaignId,
  slotsTarget,
}: {
  rows: ShortlistRow[];
  escrowAvailableKobo: number;
  platformFeeBps: number;
  campaignId: string;
  slotsTarget: number;
}) {
  const router = useRouter();
  const [removed, setRemoved] = React.useState<Set<string>>(new Set());
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  const approved = rows.filter((r) => !removed.has(r.item.id));
  const creatorFees = approved.reduce((s, r) => s + r.item.estimatedFeeKobo, 0);
  const platformFee = Math.floor((creatorFees * platformFeeBps) / 10_000);
  const committed = creatorFees + platformFee;
  const remaining = escrowAvailableKobo - committed;
  const overBudget = remaining < 0;

  const toggle = (id: string) =>
    setRemoved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
      <Panel>
        <PanelHeader
          action={
            <span className="text-[12.5px] text-ink-2">
              {approved.length} of {rows.length} approved · {slotsTarget} slots
            </span>
          }
        >
          <PanelTitle>Suggested creators</PanelTitle>
        </PanelHeader>

        <ul className="divide-y divide-line">
          {rows.map((row) => {
            const isRemoved = removed.has(row.item.id);
            const isOpen = expanded.has(row.item.id);
            const score = row.score;
            const hasFlags = (score?.reasons.length ?? 0) > 0;

            return (
              <li
                key={row.item.id}
                className={cn(
                  "px-5 py-4 transition-colors",
                  isRemoved && "bg-surface-2 opacity-55",
                )}
              >
                <div className="flex items-start gap-3.5">
                  <Avatar name={row.creator.displayName} size="lg" />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <Link
                        href={`/creators/${row.creator.id}`}
                        className="font-medium hover:underline"
                      >
                        @{row.creator.handle}
                      </Link>
                      <span className="text-[12.5px] text-ink-3">
                        {row.profile?.platform === "tiktok" ? "TikTok" : "Instagram"} ·{" "}
                        {row.profile?.locationCity}
                      </span>
                      {score && <ScoreBadge score={score.fraudScore} />}
                    </div>

                    {/* The numbers the recommendation was made from, not just
                        the recommendation. Reach is what a brand is buying;
                        followers alone say very little. */}
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
                      <Stat
                        label="Followers"
                        value={formatCount(row.profile?.followers ?? 0)}
                      />
                      <Stat
                        label="Avg views"
                        value={formatCount(row.profile?.avgViews ?? 0)}
                      />
                      <Stat
                        label="Engagement"
                        value={formatPercent(row.profile?.engagementRate ?? 0)}
                      />
                      <Stat
                        label="Reach"
                        value={
                          row.profile && row.profile.followers > 0
                            ? formatPercent(
                                row.profile.avgViews / row.profile.followers,
                              )
                            : "—"
                        }
                        hint="of followers who see a post"
                      />
                    </dl>

                    {row.profile?.categoryTags?.length ? (
                      <p className="mt-1.5 text-[12.5px] text-ink-3">
                        {row.profile.categoryTags.slice(0, 4).join(" · ")}
                      </p>
                    ) : null}

                    {/* The reasoning is the product. It is never behind a toggle. */}
                    <p className="mt-2.5 flex gap-2 text-[13px] leading-relaxed text-ink-2">
                      <Sparkles className="mt-0.5 size-4 shrink-0 text-info" />
                      <span>{row.item.aiReasoning}</span>
                    </p>

                    {hasFlags && (
                      <div className="mt-2.5">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(row.item.id)}
                          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-warn hover:underline"
                          aria-expanded={isOpen}
                        >
                          <ChevronDown
                            className={cn(
                              "size-3.5 transition-transform",
                              isOpen && "rotate-180",
                            )}
                          />
                          {score!.reasons.length} thing
                          {score!.reasons.length > 1 ? "s" : ""} the score flagged
                        </button>
                        {isOpen && (
                          <ul className="mt-2 space-y-1.5 rounded-[var(--radius-sm)] bg-warn-soft px-3 py-2.5">
                            {score!.reasons.map((reason) => (
                              <li key={reason.id} className="text-[12.5px] text-ink-2">
                                <span className="font-medium text-ink">
                                  {reason.label}
                                </span>{" "}
                                <span className="tabular-nums text-warn">
                                  {reason.delta}
                                </span>
                                <br />
                                <span className="text-ink-3">{reason.evidence}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {/* An offer, not their price.
                        This was a bare figure, which read as "what this creator
                        charges". It is the model's estimate inside your rate
                        band — the creator has not been asked yet, and naming
                        their own rate is the first thing they do. */}
                    <span className="text-right">
                      <span className="block text-[12px] uppercase tracking-wide text-ink-3">
                        Your offer
                      </span>
                      <span className="block text-[15px] font-semibold tabular-nums">
                        {formatNaira(row.item.estimatedFeeKobo)}
                      </span>
                    </span>
                    <Button
                      variant={isRemoved ? "outline" : "ghost"}
                      size="sm"
                      onClick={() => toggle(row.item.id)}
                      aria-pressed={!isRemoved}
                    >
                      {isRemoved ? (
                        <>
                          <Check /> Put back
                        </>
                      ) : (
                        <>
                          <X /> Remove
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </Panel>

      {/* What approving actually costs, updating as you decide. */}
      <Panel className="lg:sticky lg:top-20">
        <PanelHeader>
          <PanelTitle>What this reserves</PanelTitle>
        </PanelHeader>
        <PanelBody className="space-y-3">
          <Row
            label={`Offers to ${approved.length} creator${approved.length === 1 ? "" : "s"}`}
            value={formatNaira(creatorFees)}
          />
          <Row
            label={`SubSquad fee · ${platformFeeBps / 100}%`}
            value={formatNaira(platformFee)}
          />
          <div className="border-t border-ink pt-3">
            <Row label="Reserved from escrow" value={formatNaira(committed)} strong />
          </div>
          <Row
            label="Left in escrow"
            value={formatNaira(Math.abs(remaining))}
            tone={overBudget ? "danger" : "muted"}
            prefix={overBudget ? "over by " : undefined}
          />

          {overBudget ? (
            <p className="rounded-[var(--radius-sm)] bg-danger-soft px-3 py-2.5 text-[12.5px] leading-relaxed text-danger">
              This shortlist costs more than the campaign holds. Remove a creator, or{" "}
              <Link href="/wallet/deposit" className="font-medium underline">
                add funds
              </Link>{" "}
              first.
            </p>
          ) : (
            <p className="text-[12.5px] leading-relaxed text-ink-3">
              Nothing is sent yet. Approving drafts an invite per creator for you
              to review before it reaches anyone.
            </p>
          )}
        </PanelBody>
        <PanelFooter>
          These are the fees you are offering, not what the creators charge. Each
          one can accept, or name their own rate for you to answer — the total
          here is the most this shortlist can cost, not what it will.
        </PanelFooter>
        <div className="space-y-2 border-t border-line p-4">
          <ActionButton
            variant="brand"
            block
            disabled={overBudget || approved.length === 0}
            action={() =>
              approveShortlist(campaignId, [...removed])
            }
            onDone={(result) => {
              // The page is a server component, so the new deals only appear
              // after a refresh. Without this the screen still shows the
              // shortlist it has just consumed.
              if (result.ok) router.refresh();
            }}
            confirm={{
              title: `Approve ${approved.length} creator${approved.length === 1 ? "" : "s"}?`,
              body: `This reserves up to ${formatNaira(committed)} from escrow and writes one invite per creator. Nothing is sent — each draft waits for you in Outreach, and a creator may still name a different rate.`,
              confirmLabel: `Approve ${approved.length} and draft invites`,
            }}
          >
            Approve {approved.length} and draft invites
          </ActionButton>

          <GenerateShortlistButton campaignId={campaignId} regenerate block />
        </div>
      </Panel>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  tone,
  prefix,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "danger" | "muted";
  prefix?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-[13.5px]">
      <span className={cn(strong ? "font-medium text-ink" : "text-ink-2")}>{label}</span>
      <span
        className={cn(
          "tabular-nums",
          strong && "text-[17px] font-semibold",
          tone === "danger" && "text-danger",
          tone === "muted" && "text-ink-2",
        )}
      >
        {prefix}
        {value}
      </span>
    </div>
  );
}

/** One number from the profile, labelled so it needs no explanation. */
function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <dt className="text-[12px] uppercase tracking-wide text-ink-3">
        {label}
      </dt>
      <dd
        className="text-[14px] font-medium tabular-nums"
        title={hint}
      >
        {value}
      </dd>
    </div>
  );
}
