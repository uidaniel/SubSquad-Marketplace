import Link from "next/link";
import { User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Display, Eyebrow, Wrap } from "@/components/marketing/pieces";
import {
  Card,
  Chip,
  ClosingPoster,
  Faq,
  Row,
  Section,
  SectionHead,
  Ticks,
} from "@/components/marketing/blocks";

export const metadata = {
  title: "Pricing",
  description:
    "12% on top of the creator’s fee when a campaign deal completes. 6% when a creator brings the deal. ₦0 for creators.",
};

/**
 * Two numbers, a worked example both ways, and the questions people ask
 * about money. The page exists so nobody has to book a call to learn a
 * percentage.
 */
export default function PricingPage() {
  return (
    <>
      <section className="py-16 sm:py-24">
        <Wrap className="flex flex-col items-center text-center">
          <p data-hero>
            <Eyebrow>Pricing</Eyebrow>
          </p>
          <Display as="h1" size="xl" className="mt-4 max-w-[15ch]" data-hero>
            You pay when a deal <span className="text-brand-ink">completes.</span>
          </Display>
          <p data-hero className="mt-6 max-w-[48ch] text-[17px] leading-relaxed text-ink-2 sm:text-[18px]">
            No subscription. No seat fees. No charge to set up, and nothing at all if a campaign doesn&rsquo;t run.
          </p>
        </Wrap>
      </section>

      <Section tight>
        <div data-reveal-group className="grid gap-5 md:grid-cols-2">
          <Card className="p-7 sm:p-9">
            <Chip tone="info">Campaign deals</Chip>
            <p className="mt-5 font-display text-[clamp(56px,7vw,88px)] font-semibold leading-none tracking-[-0.05em] tabular-nums text-brand-ink">
              12%
            </p>
            <p className="mt-4 text-[16.5px] leading-relaxed text-ink-2">
              Added to each creator fee when the deal completes. For brands and agencies running campaigns through the
              platform.
            </p>
            <div className="my-6 border-t border-line" />
            <Ticks
              items={[
                "AI shortlisting and fraud scoring, with reasons",
                "Outreach and negotiation inside the ceiling you set",
                "Contract, escrow and payout on every deal",
                "Content review against your brief, before you see it",
                "Unlimited seats, client spaces and campaigns",
              ]}
            />
            <Button variant="brand" size="lg" block className="mt-8" asChild>
              <Link href="/signup">Start a campaign</Link>
            </Button>
          </Card>

          <Card flat className="p-7 sm:p-9">
            <Chip tone="ok">Creator-brought deals</Chip>
            <p className="mt-5 font-display text-[clamp(56px,7vw,88px)] font-semibold leading-none tracking-[-0.05em] tabular-nums">
              6%
            </p>
            <p className="mt-4 text-[16.5px] leading-relaxed text-ink-2">
              When a creator brings a brand they already found. Added on top for the brand, so the creator keeps their
              full quote.
            </p>
            <div className="my-6 border-t border-line" />
            <Ticks
              items={[
                "Contract generated and sent to the brand",
                "Guest checkout — the brand needs no account",
                "Escrow, content approval and payout",
              ]}
            />
            <Button variant="outline" size="lg" block className="mt-8" asChild>
              <Link href="/for-creators">Bring your own deal</Link>
            </Button>
          </Card>
        </div>

        <Card className="mt-6 flex flex-wrap items-center gap-5 p-6" data-reveal>
          <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-ok-soft text-ok">
            <User className="size-5" />
          </span>
          <div className="min-w-[260px] flex-1">
            <h2 className="text-[17px] font-semibold tracking-[-0.01em]">Creators pay ₦0</h2>
            <p className="mt-1 text-[15px] leading-relaxed text-ink-2">
              Not a subscription, not a listing fee, not a cut of the rate. Now or later. Our fee comes from the brand,
              and that is the whole business model.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/for-creators">For creators</Link>
          </Button>
        </Card>
      </Section>

      <Section>
        <SectionHead
          eyebrow="A worked example"
          title={
            <>
              What a campaign <span className="text-brand-ink">actually costs.</span>
            </>
          }
        />
        <div data-reveal-group className="grid gap-5 md:grid-cols-2">
          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-[17px] font-semibold">A brand running it directly</h3>
              <Chip tone="info">No agency</Chip>
            </div>
            <Row k="15 creators, average fee" v="₦80,000" />
            <Row k="Creator fees" v="₦1,200,000" />
            <Row k="SubSquad, 12%" v="₦144,000" />
            <Row k="Total cost" v="₦1,344,000" total />
            <p className="mt-3 text-[12.5px] text-ink-3">Every naira of the ₦1,200,000 reaches a creator. You see both numbers.</p>
          </Card>
          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-[17px] font-semibold">The same campaign via an agency</h3>
              <Chip tone="info">15% margin</Chip>
            </div>
            <Row k="Creator fees" v="₦1,200,000" />
            <Row k="Agency margin, 15%" v="₦180,000" />
            <Row k="SubSquad, 12%" v="₦144,000" />
            <Row k="Invoiced to the client" v="₦1,524,000" total />
            <p className="mt-3 text-[12.5px] text-ink-3">The agency sets the margin. Creators never see it.</p>
          </Card>
        </div>
      </Section>

      <Section tight>
        <Faq
          eyebrow="Questions"
          title={
            <>
              On <span className="text-brand-ink">money.</span>
            </>
          }
          items={[
            {
              q: "When exactly are we charged?",
              a: "When a deal completes — the content is live, verified, and the creator has been paid. Deposits cost nothing, cancelled deals cost nothing, and creators who never accept cost nothing.",
            },
            {
              q: "What happens to money we don’t spend?",
              a: "It stays in your wallet, available for the next campaign. A cancelled campaign’s escrow returns to the wallet at once.",
            },
            { q: "Is there a minimum?", a: "No. Fund what the campaign needs." },
            {
              q: "Are there card or transfer fees on top?",
              a: "Card payments carry Paystack’s processing fee, shown before you confirm. Bank transfers you record against the wallet carry none. We add nothing to either.",
            },
          ]}
        />
      </Section>

      <ClosingPoster
        title={
          <>
            Nothing to sign.
            <br />
            Nothing monthly.
          </>
        }
        lede="Fund a budget, run a campaign, pay 12% on the deals that complete."
        primary={{ href: "/signup", label: "Start a campaign" }}
        secondary={{ href: "/for-agencies", label: "Talk to us first" }}
        trust={[
          { icon: "ban", label: "No subscription" },
          { icon: "shield", label: "12% only when a deal completes" },
          { icon: "refresh", label: "Unused budget stays yours" },
        ]}
      />
    </>
  );
}
