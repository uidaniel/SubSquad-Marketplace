import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, Clock, Lock, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InviteActions } from "./invite-actions";
import { Authorisation } from "./authorisation";
import { TabGroup } from "@/components/ui/tab-group";
import { getInviteByToken } from "@/lib/data/creator-queries";
import { formatNaira } from "@/lib/money";
import { cn, formatDate, formatRelative } from "@/lib/utils";
import { NOW } from "@/lib/data/queries";

export const metadata = { title: "A deal for you" };

const TABS = ["deal", "content", "terms"] as const;
type Tab = (typeof TABS)[number];

const READABLE_DELIVERABLE: Record<string, string> = {
  tiktok_video: "TikTok video",
  ig_reel: "Instagram reel",
  ig_story: "Instagram story",
  yt_short: "YouTube short",
  x_post: "X post",
};

/**
 * The deal, as the creator sees it.
 *
 * This is the first thing a creator opens, usually from an email, on a
 * mid-range Android phone, about a brand they have never heard of. Every scam
 * they have been sent looks like an opportunity, so the page leads with what
 * separates it from one: the money, and that it is already held by somebody who
 * is not the brand.
 *
 * It used to be a single scroll ending in Accept. That was too little to decide
 * on and too much to read at once, so it is three tabs now — what the deal is,
 * what they would have to make, and what they would be agreeing to — with the
 * money and the decision pinned outside them. A creator deciding whether to
 * spend a day filming deserves to see the brief before saying yes, and to see
 * the terms before signing.
 */
export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ token }, { tab }] = await Promise.all([params, searchParams]);
  const invite = await getInviteByToken(token);
  if (!invite) notFound();

  const {
    deal,
    creator,
    campaign,
    brandName,
    agencyName,
    agencyVerified,
    agencyCac,
    agencyVerifiedAt,
    deliverableType,
    deliverableCount,
    proposedFeeKobo,
    rateProposedAt,
    feeSecured,
  } = invite;

  const active: Tab = TABS.includes(tab as Tab) ? (tab as Tab) : "deal";
  const brief = campaign?.brief;
  const deliverable = `${deliverableCount} × ${
    READABLE_DELIVERABLE[deliverableType ?? ""] ?? "video"
  }`;

  const dueDate = formatDate(deal.deadline, NOW);
  const dueRelative = formatRelative(deal.deadline, NOW);
  const dueLabel = dueRelative === dueDate ? dueDate : `${dueDate} · ${dueRelative}`;

  // Waiting on the brand is a state of its own. Without saying so the page just
  // looks like it ignored them.
  const awaitingBrand = proposedFeeKobo !== null;
  const settled = ["accepted", "contract_signed", "draft_submitted", "approved", "published", "paid"].includes(
    deal.status,
  );

  return (
    <main className="mx-auto min-h-screen w-full max-w-[640px] px-4 pb-40 pt-6">
      <header className="mb-6 flex flex-wrap items-center gap-2">
        <span className="grid size-6 place-items-center rounded-[6px] bg-brand text-[12px] font-bold text-white">
          SS
        </span>
        <span className="text-[15px] font-semibold">SubSquad</span>
        <Badge tone="ok" dot className="ml-auto">
          Funds held
        </Badge>
      </header>

      <p className="text-[14px] text-ink-2">
        Hi {creator.displayName.split(" ")[0]} — {brandName} would like to work
        with you.
      </p>

      {/* The money, stated once, as large as it deserves. */}
      <section className="mt-5 rounded-[var(--radius-lg)] border border-line bg-surface p-5">
        <p className="text-[12.5px] text-ink-2">
          {awaitingBrand ? "You asked for" : settled ? "You will be paid" : "The budget for this"}
        </p>
        <p className="mt-1 text-[38px] font-semibold leading-none tracking-[-0.03em] tabular-nums">
          {formatNaira(awaitingBrand ? proposedFeeKobo! : deal.feeKobo)}
        </p>

        {awaitingBrand ? (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-warn-soft px-3 py-1.5 text-[12.5px] font-medium text-warn">
            <Clock className="size-3.5" />
            Waiting on {brandName} — asked {formatRelative(rateProposedAt, NOW)}
          </p>
        ) : (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-ok-soft px-3 py-1.5 text-[12.5px] font-medium text-ok">
            <Lock className="size-3.5" />
            {feeSecured
              ? "This fee is already held in escrow"
              : "Being funded now"}
          </p>
        )}

        <p className="mt-3 text-[13px] leading-relaxed text-ink-2">
          SubSquad holds the money, not the brand. It is released to you once your
          post is live and verified — normally within 7 days.
        </p>
      </section>

      <Authorisation
        agencyName={agencyName}
        agencyVerified={agencyVerified}
        agencyCac={agencyCac}
        agencyVerifiedAt={agencyVerifiedAt}
        brandName={brandName}
        campaignName={campaign?.name ?? "this campaign"}
        feeSecured={feeSecured}
        feeKobo={awaitingBrand ? proposedFeeKobo! : deal.feeKobo}
      />

      {/* Three tabs, because one scroll was both too little and too much. */}
      <div className="mt-6">
        <TabGroup
          tabs={[
            { key: "deal", label: "Deal info" },
            { key: "content", label: "What to make" },
            { key: "terms", label: "Terms & payment" },
          ]}
          initial={active}
        >

          <div data-tab="deal" className="space-y-4 pt-4">
          <Card title="What they are asking for">
            <Row label="Deliverable" value={deliverable} />
            {/* `formatRelative` falls back to the date beyond 30 days, which
                rendered "30 Oct · 30 Oct". Only show it when it says something
                the date does not. */}
            <Row label="Due" value={dueLabel} />
            <Row label="Campaign" value={campaign?.name ?? "Direct deal"} />
            {brief?.audience.cities.length ? (
              <Row label="Audience" value={brief.audience.cities.join(", ")} />
            ) : null}
            <Row
              label="Language"
              value={brief?.audience.languages.join(", ") || "English"}
            />
          </Card>

          {brief?.product && (
            <Card title="About the product">
              <p className="px-5 py-4 text-[13.5px] leading-relaxed text-ink-2">
                {brief.product}
              </p>
            </Card>
          )}

          <Timeline deadline={deal.deadline} status={deal.status} />
          </div>

          <div data-tab="content" className="space-y-4 pt-4">
          {brief ? (
            <>
              <Card title="Every video must get across">
                {/* Deduped: the campaign form writes the same lines into both
                    key_messages and must_include, so concatenating them showed
                    every requirement twice. */}
                <Bullets
                  items={[...new Set([...brief.keyMessages, ...brief.mustInclude])]}
                  tone="good"
                  empty="Nothing specific — make it your way."
                />
              </Card>
              <Card title="It must never">
                <Bullets
                  items={brief.mustAvoid}
                  tone="bad"
                  empty="Nothing listed."
                />
              </Card>
              {brief.tone && (
                <Card title="Tone">
                  <p className="px-5 py-4 text-[13.5px] leading-relaxed text-ink-2">
                    {brief.tone}
                  </p>
                </Card>
              )}
              <p className="text-[12.5px] leading-relaxed text-ink-3">
                You write it your way. We check it against this list before the
                brand sees it, so you get one clear set of fixes rather than five
                rounds of notes.
              </p>
            </>
          ) : (
            <Card title="The brief">
              <p className="px-5 py-4 text-[13.5px] text-ink-3">
                No brief was attached to this deal.
              </p>
            </Card>
          )}
          </div>

          <div data-tab="terms" className="space-y-4 pt-4">
          <Card title="Payment">
            <Row
              label="Fee"
              value={formatNaira(awaitingBrand ? proposedFeeKobo! : deal.feeKobo)}
            />
            <Row
              label="Held in escrow"
              value={feeSecured ? "Yes, in full" : "Being funded"}
            />
            <Row
              label="Paid"
              value="Automatically, once your post is verified live"
            />
            <Row label="Platform fee to you" value="None" />
          </Card>

          <Card title="Rights and rules">
            <Row
              label="Usage rights"
              value={`${brief?.usageRightsDays ?? 90} days`}
            />
            <Row
              label="Disclosure"
              value={`${brief?.disclosureTag ?? "#ad"} — required by ARCON`}
            />
            <Row label="Who owns the video" value="You do" />
          </Card>

          <p className="text-[12.5px] leading-relaxed text-ink-3">
            The full agreement is at{" "}
            <Link
              href="/legal/creator-agreement"
              className="font-medium text-brand-ink underline underline-offset-2"
            >
              subsquad.ng/legal
            </Link>
            . It is short, and it is what makes the escrow enforceable.
          </p>
          </div>
        </TabGroup>
      </div>

      <p className="mt-8 text-[12.5px] text-ink-3">
        Sent to @{creator.handle}.
        {deal.status === "invited" && !awaitingBrand
          ? " If this is not for you, decline below — we will not chase you."
          : ""}
      </p>

      {/* Whatever is next, pinned where a thumb is.
          Every state gets an answer. An agreed deal used to show nothing at all
          — the page simply ended, and a creator who had just been told their
          rate was accepted had no way to go on. */}
      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-ground/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] backdrop-blur-md">
        <div className="mx-auto w-full max-w-[640px]">
          {awaitingBrand ? (
            <NextStep
              note={`You asked for ${formatNaira(proposedFeeKobo!)}. ${brandName} has been told and will reply here — we will email you either way.`}
            />
          ) : deal.status === "invited" ? (
            <InviteActions
              token={token}
              feeKobo={deal.feeKobo}
              rateBandMaxKobo={campaign?.rateBandMaxKobo ?? null}
            />
          ) : deal.status === "accepted" ? (
            <NextStep
              href={`/i/${token}/onboarding`}
              label="Sign the contract and start"
              note="Two minutes: confirm your phone, add the bank account we pay into, and sign."
            />
          ) : deal.status === "contract_signed" ? (
            <NextStep
              href="/creator"
              label="Upload your draft"
              note="We check it against the brief before the brand sees it."
            />
          ) : deal.status === "revision_requested" ? (
            <NextStep
              href="/creator"
              label="Upload a new version"
              note="One clear set of fixes, not five rounds of notes."
            />
          ) : deal.status === "draft_submitted" ? (
            <NextStep note="Your draft is with us. We check it against the brief, then the brand sees it." />
          ) : deal.status === "approved" ? (
            <NextStep
              href="/creator"
              label="Post it, then paste the link"
              note="Payment releases once we can see it is live."
            />
          ) : deal.status === "published" ? (
            <NextStep note="We are verifying your post. Payment releases automatically once it checks out." />
          ) : deal.status === "paid" ? (
            <NextStep
              href="/creator/wallet"
              label="See your money"
              note={`${formatNaira(deal.feeKobo)} has been released to you.`}
            />
          ) : (
            <NextStep note="This deal is closed. Nothing further is needed from you." />
          )}
        </div>
      </div>
    </main>
  );
}

/**
 * What happens next, with dates.
 *
 * A creator agreeing to this is agreeing to a schedule, and a schedule they
 * cannot see is one they will miss. Every step is relative to the deadline
 * rather than invented, so it stays true when the deadline moves.
 */
function Timeline({
  deadline,
  status,
}: {
  deadline: string | null;
  status: string;
}) {
  const due = deadline ? new Date(deadline) : null;
  const draftDue = due ? new Date(due.getTime() - 3 * 86_400_000) : null;

  const steps = [
    { label: "You accept or name your rate", when: "Now", done: status !== "invited" },
    {
      label: "Contract signed",
      when: "Same day",
      done: ["contract_signed", "draft_submitted", "approved", "published", "paid"].includes(status),
    },
    {
      label: "First draft to us",
      when: draftDue ? formatDate(draftDue.toISOString(), NOW) : "3 days before the deadline",
      done: ["draft_submitted", "approved", "published", "paid"].includes(status),
    },
    {
      label: "Published and verified",
      when: due ? formatDate(due.toISOString(), NOW) : "the agreed date",
      done: ["published", "paid"].includes(status),
    },
    {
      label: "Paid to your bank",
      when: "Within 24 hours of verification",
      done: status === "paid",
    },
  ];

  return (
    <Card title="What happens, and when">
      <ol className="px-5 py-4">
        {steps.map((step, i) => (
          <li key={step.label} className="flex gap-3 pb-4 last:pb-0">
            <span className="relative flex flex-col items-center">
              <span
                className={cn(
                  "grid size-4 shrink-0 place-items-center rounded-full border-2",
                  step.done
                    ? "border-ok bg-ok text-white"
                    : "border-line bg-surface",
                )}
              >
                {step.done && <Check className="size-2.5" />}
              </span>
              {i < steps.length - 1 && (
                <span className="mt-1 w-0.5 flex-1 bg-line" aria-hidden />
              )}
            </span>
            <span className="min-w-0 flex-1 pb-1">
              <span className="block text-[13.5px] font-medium">{step.label}</span>
              <span className="block text-[12.5px] text-ink-3">{step.when}</span>
            </span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-line bg-surface">
      <div className="border-b border-line px-5 py-3">
        <h2 className="text-[13.5px] font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-line px-5 py-3 last:border-b-0">
      <dt className="text-[13px] text-ink-2">{label}</dt>
      <dd className="text-[13.5px] font-medium">{value}</dd>
    </div>
  );
}

function Bullets({
  items,
  tone,
  empty,
}: {
  items: string[];
  tone: "good" | "bad";
  empty: string;
}) {
  if (items.length === 0) {
    return <p className="px-5 py-4 text-[13px] text-ink-3">{empty}</p>;
  }
  const Icon = tone === "good" ? Check : X;
  return (
    <ul className="px-5 py-4">
      {items.map((item) => (
        <li key={item} className="flex gap-2.5 pb-2.5 text-[13.5px] leading-relaxed last:pb-0">
          <Icon
            className={cn(
              "mt-0.5 size-4 shrink-0",
              tone === "good" ? "text-ok" : "text-danger",
            )}
          />
          <span className="text-ink-2">{item}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The one thing to do next, or the reason there is nothing.
 *
 * A creator should never reach the bottom of this page and wonder what happens
 * now. Where there is an action it is a button; where there is not, the page
 * says who is holding it and what they are doing.
 */
function NextStep({
  href,
  label,
  note,
}: {
  href?: string;
  label?: string;
  note: string;
}) {
  return (
    <div className="space-y-2">
      {href && label && (
        <Button variant="brand" size="lg" block asChild>
          <Link href={href}>
            {label} <ArrowRight />
          </Link>
        </Button>
      )}
      <p className="text-center text-[12.5px] leading-relaxed text-ink-2">
        {note}
      </p>
    </div>
  );
}
