import { notFound } from "next/navigation";
import { Check, Lock, ShieldCheck } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getInviteByToken } from "@/lib/data/creator-queries";
import { formatNaira } from "@/lib/money";
import { formatDate, formatRelative } from "@/lib/utils";
import { NOW } from "@/lib/data/queries";

export const metadata = { title: "Your invite" };

/**
 * The invite landing page.
 *
 * This is the first thing a creator sees, usually from a WhatsApp link, on a
 * mid-range Android phone, from a brand they have never heard of. Every scam
 * they have been sent looks like an opportunity, so this page leads with the
 * two facts that separate it from one: the exact fee, and that the money is
 * already held. The accept button comes after those, not before.
 */
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await getInviteByToken(token);
  if (!invite) notFound();

  const { deal, creator, campaign, brandName, escrowHeldKobo } = invite;

  return (
    <main className="mx-auto min-h-screen w-full max-w-[560px] px-4 pb-32 pt-6">
      <header className="mb-6 flex items-center gap-2">
        <span className="grid size-6 place-items-center rounded-[6px] bg-brand text-[11px] font-bold text-white">
          SS
        </span>
        <span className="text-[15px] font-semibold">SubSquad</span>
        <Badge tone="ok" dot className="ml-auto">
          Funds held
        </Badge>
      </header>

      <p className="text-[14px] text-ink-2">
        Hi {creator.displayName.split(" ")[0]} — {brandName} would like to work with
        you.
      </p>

      {/* The fee, stated once, as large as it deserves to be. */}
      <div className="mt-5 rounded-[var(--radius-lg)] border border-line bg-surface p-5">
        <p className="text-[12.5px] text-ink-2">You will be paid</p>
        <p className="mt-1 text-[40px] font-semibold leading-none tracking-[-0.03em] tabular-nums">
          {formatNaira(deal.feeKobo)}
        </p>
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-ok-soft px-3 py-1.5 text-[12.5px] font-medium text-ok">
          <Lock className="size-3.5" />
          Already held in escrow — {formatNaira(escrowHeldKobo)} is locked for this
          campaign
        </p>
        <p className="mt-3 text-[13px] leading-relaxed text-ink-2">
          SubSquad holds the money, not the brand. It is released to you once your
          post is live and verified — normally within 7 days.
        </p>
      </div>

      <section className="mt-5 rounded-[var(--radius-lg)] border border-line bg-surface">
        <div className="border-b border-line px-5 py-3.5">
          <h2 className="text-[14px] font-semibold">What they are asking for</h2>
        </div>
        <dl className="divide-y divide-line">
          <Row label="Brand" value={brandName} />
          <Row label="Deliverable" value="1 TikTok video" />
          <Row
            label="Due"
            value={`${formatDate(deal.deadline, NOW)} · ${formatRelative(deal.deadline, NOW)}`}
          />
          <Row label="Usage rights" value={`${campaign?.brief.usageRightsDays ?? 90} days organic`} />
          <Row label="Disclosure" value={`${campaign?.brief.disclosureTag ?? "#ad"} required`} />
        </dl>
      </section>

      {campaign && (
        <section className="mt-5 rounded-[var(--radius-lg)] border border-line bg-surface p-5">
          <h2 className="text-[14px] font-semibold">The brief, in short</h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">
            {campaign.brief.product}. {campaign.brief.tone}.
          </p>
          <ul className="mt-3 space-y-2">
            {campaign.brief.keyMessages.map((message) => (
              <li key={message} className="flex gap-2 text-[13.5px]">
                <Check className="mt-0.5 size-4 shrink-0 text-ok" />
                {message}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[12.5px] text-ink-3">
            You write it your way. We check it against the brief before the brand
            sees it, so you get one clear list of fixes rather than five rounds of
            notes.
          </p>
        </section>
      )}

      <section className="mt-5 flex items-start gap-3 rounded-[var(--radius-lg)] bg-surface-2 p-4">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-ok" />
        <p className="text-[12.5px] leading-relaxed text-ink-2">
          Nobody is contacted until a brand has funded the deal, so this is not an
          &ldquo;exposure&rdquo; offer. If the brand pulls out after you have
          delivered, you are paid from escrow anyway.
        </p>
      </section>

      <div className="mt-6 flex items-center gap-2">
        <Avatar name={creator.displayName} size="sm" />
        <p className="text-[12.5px] text-ink-3">
          Sent to @{creator.handle} · reply STOP on WhatsApp to never hear from us
          again
        </p>
      </div>

      {/* One decision, pinned where a thumb is. */}
      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-ground/95 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto w-full max-w-[560px]">
          <Button variant="brand" size="lg" block>
            Accept — {formatNaira(deal.feeKobo)}
          </Button>
          <div className="mt-2 flex gap-2">
            <Button variant="outline" block>
              Ask for more
            </Button>
            <Button variant="ghost" block>
              Not for me
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-5 py-3">
      <dt className="text-[13px] text-ink-2">{label}</dt>
      <dd className="text-right text-[13.5px] font-medium">{value}</dd>
    </div>
  );
}
