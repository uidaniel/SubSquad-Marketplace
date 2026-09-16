import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Lock,
  Upload,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DealStatusBadge } from "@/components/app/status";
import { getCreatorDeal, getCurrentCreator } from "@/lib/data/creator-queries";
import { NOW } from "@/lib/data/queries";
import { formatNaira } from "@/lib/money";
import { cn, formatDate, formatRelative } from "@/lib/utils";
import { NoCreatorSession } from "@/app/creator/no-session";

export const metadata = { title: "Deal" };

/**
 * The creator's view of one deal.
 *
 * Ordered by what the creator needs at this moment rather than by the shape of
 * the record: what to do now, then what they are being paid, then the brief.
 * The AI checklist appears here in the creator's own words — the same text the
 * agency sees, so nobody is being told two different stories.
 */
export default async function CreatorDealPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const creator = await getCurrentCreator();
  if (!creator) return <NoCreatorSession what="this deal" />;
  const view = await getCreatorDeal(creator.id, id);
  if (!view) notFound();

  const { deal, brandName, campaign, latestDraft, takeHomeKobo } = view;
  const review = latestDraft?.aiReview;
  const needsFix = deal.status === "revision_requested";

  return (
    <>
      <Link
        href="/creator"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-ink-2"
      >
        <ArrowLeft className="size-4" /> Your deals
      </Link>

      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{brandName}</h1>
        <DealStatusBadge status={deal.status} />
      </div>
      <p className="mt-1 text-[13.5px] text-ink-2">
        {campaign?.name ?? "Your own deal"} · due {formatDate(deal.deadline, NOW)} (
        {formatRelative(deal.deadline, NOW)})
      </p>

      {/* What to do now, if anything. */}
      {needsFix && review && (
        <section className="mt-5 rounded-[var(--radius-lg)] border border-warn/30 bg-warn-soft p-5">
          <h2 className="flex items-center gap-2 text-[14px] font-semibold text-warn">
            <AlertTriangle className="size-4" /> Two quick fixes needed
          </h2>
          <p className="mt-2 whitespace-pre-line text-[13.5px] leading-relaxed text-ink-2">
            {review.creatorFeedback}
          </p>
          <Button variant="brand" block className="mt-4">
            <Upload /> Upload a new version
          </Button>
        </section>
      )}

      {deal.status === "contract_signed" && (
        <section className="mt-5 rounded-[var(--radius-lg)] border border-brand/40 bg-surface p-5">
          <h2 className="text-[14px] font-semibold">Ready when you are</h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">
            Upload your draft and we will check it against the brief before the brand
            sees it — so you get one clear list of fixes, not five rounds of notes.
          </p>
          <Button variant="brand" block className="mt-4">
            <Upload /> Upload your draft
          </Button>
        </section>
      )}

      {/* The money, stated plainly. */}
      <section className="mt-5 rounded-[var(--radius-lg)] border border-line bg-surface p-5">
        <p className="text-[12.5px] text-ink-2">You are paid</p>
        <p className="mt-1 text-[32px] font-semibold leading-none tracking-[-0.03em] tabular-nums">
          {formatNaira(takeHomeKobo)}
        </p>
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-ok-soft px-3 py-1.5 text-[12.5px] font-medium text-ok">
          <Lock className="size-3.5" />
          {deal.status === "paid" ? "Paid out" : "Held in escrow for you"}
        </p>
        {deal.feePaidBy === "creator" && (
          <p className="mt-2.5 text-[12px] text-ink-3">
            The {deal.platformFeeBps / 100}% SubSquad fee comes out of this, as you
            agreed when you created the deal.
          </p>
        )}
      </section>

      {/* The review, if there has been one. */}
      {review && (
        <section className="mt-5 rounded-[var(--radius-lg)] border border-line bg-surface">
          <div className="border-b border-line px-5 py-3.5">
            <h2 className="text-[14px] font-semibold">
              What we checked on version {latestDraft!.version}
            </h2>
          </div>
          <ul className="divide-y divide-line px-5">
            {review.checks.map((check) => {
              const Icon =
                check.status === "pass"
                  ? Check
                  : check.status === "fail"
                    ? X
                    : AlertTriangle;
              return (
                <li key={check.id} className="flex gap-2.5 py-3">
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
                    <span className="block text-[13.5px]">{check.label}</span>
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
        </section>
      )}

      {/* The brief. */}
      {campaign && (
        <section className="mt-5 rounded-[var(--radius-lg)] border border-line bg-surface p-5">
          <h2 className="text-[14px] font-semibold">What they asked for</h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">
            {campaign.brief.product}. Tone: {campaign.brief.tone}.
          </p>
          <ul className="mt-3 space-y-2">
            {[...campaign.brief.keyMessages, ...campaign.brief.mustInclude].map((item) => (
              <li key={item} className="flex gap-2 text-[13.5px]">
                <Check className="mt-0.5 size-4 shrink-0 text-ok" />
                {item}
              </li>
            ))}
            {campaign.brief.mustAvoid.map((item) => (
              <li key={item} className="flex gap-2 text-[13.5px]">
                <X className="mt-0.5 size-4 shrink-0 text-danger" />
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone="neutral">{campaign.brief.disclosureTag} required</Badge>
            <Badge tone="neutral">
              {campaign.brief.usageRightsDays} days usage rights
            </Badge>
          </div>
        </section>
      )}

      {deal.publishedUrl && (
        <section className="mt-5 rounded-[var(--radius-lg)] border border-line bg-surface p-5">
          <h2 className="text-[14px] font-semibold">Your post</h2>
          <a
            href={deal.publishedUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 block break-all text-[13px] text-brand-ink hover:underline"
          >
            {deal.publishedUrl}
          </a>
        </section>
      )}

      <p className="mt-6 text-center text-[12.5px] leading-relaxed text-ink-3">
        Something wrong with this deal? Reply to any of our WhatsApp messages and a
        person will answer.
      </p>
    </>
  );
}
