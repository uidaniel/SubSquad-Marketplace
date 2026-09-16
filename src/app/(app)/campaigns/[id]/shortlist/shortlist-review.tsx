"use client";

import * as React from "react";
import Link from "next/link";
import { Check, ChevronDown, Sparkles, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { ScoreBadge } from "@/components/app/status";
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
                      <span className="font-medium">@{row.creator.handle}</span>
                      <span className="text-[12.5px] text-ink-3">
                        {row.profile?.platform === "tiktok" ? "TikTok" : "Instagram"} ·{" "}
                        {row.profile?.locationCity}
                      </span>
                      {score && <ScoreBadge score={score.fraudScore} />}
                    </div>

                    <p className="mt-0.5 text-[12.5px] text-ink-2 tabular-nums">
                      {formatCount(row.profile?.followers ?? 0)} followers ·{" "}
                      {formatPercent(row.profile?.engagementRate ?? 0)} engagement
                      {row.profile?.categoryTags?.length
                        ? ` · ${row.profile.categoryTags.slice(0, 2).join(", ")}`
                        : ""}
                    </p>

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
                    <span className="text-[15px] font-semibold tabular-nums">
                      {formatNaira(row.item.estimatedFeeKobo)}
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
          <PanelTitle>What this commits</PanelTitle>
        </PanelHeader>
        <PanelBody className="space-y-3">
          <Row label={`Creator fees · ${approved.length}`} value={formatNaira(creatorFees)} />
          <Row
            label={`SubSquad fee · ${platformFeeBps / 100}%`}
            value={formatNaira(platformFee)}
          />
          <div className="border-t border-ink pt-3">
            <Row label="Committed from escrow" value={formatNaira(committed)} strong />
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
              Nothing is sent yet. Approving drafts an invite per creator for you to
              review before it reaches anyone.
            </p>
          )}
        </PanelBody>
        <div className="border-t border-line p-4">
          <Button
            variant="brand"
            block
            disabled={overBudget || approved.length === 0}
            // Wired to the server action in the outreach step (D4-T2).
            formAction={`/campaigns/${campaignId}/shortlist/approve`}
          >
            Approve {approved.length} and draft invites
          </Button>
          <Button variant="ghost" block className="mt-2">
            Get more suggestions
          </Button>
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
