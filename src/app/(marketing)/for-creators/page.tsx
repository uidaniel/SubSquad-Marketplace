import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Closing, Display, Hero, Line, Proof, Register } from "@/components/marketing/pieces";

export const metadata = {
  title: "For creators",
  description:
    "A brand deal from SubSquad arrives with the fee already held. See it, counter it, sign on your phone, and get paid within 7 days of going live.",
};

/**
 * Written for somebody on a phone who has been scammed before. The fee comes
 * first, then the proof it is held, then what they can change. Nothing here
 * asks them for anything.
 */
export default function ForCreatorsPage() {
  return (
    <>
      <Hero
        eyebrow="For creators"
        title={
          <>
            The money is there{" "}
            <span className="text-brand-ink">before we message you.</span>
          </>
        }
        lede="A brand deal from SubSquad arrives with the fee already held. You see it, you counter it if you want, you sign on your phone, and you are paid within 7 days of going live."
        primary={{ href: "/login", label: "Sign in to your deals" }}
        secondary={{ href: "/legal/creator-agreement", label: "Read the creator agreement" }}
        ticks={["₦0 taken from your fee", "A real contract, every time", "Paid to your bank, in naira"]}
        aside={
          <Proof label="What an invite looks like">
            <div className="p-4">
              <p className="text-[14px] text-ink-2">Sweet Sensation wants a TikTok video from you.</p>
              <p className="mt-3 font-display text-[44px] font-semibold leading-none tracking-[-0.035em] tabular-nums">
                ₦120,000
              </p>
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-ok-soft px-2.5 py-1 text-[12.5px] font-semibold text-ok">
                <span className="size-1.5 rounded-full bg-ok" aria-hidden />
                Already held in escrow
              </p>
            </div>
            <Line k="Brand" v="Sweet Sensation" />
            <Line k="Run by" v="Konga Digital · verified" />
            <Line k="Due" v="22 Sep" />
            {/* A picture of the two choices, not the choices: nothing here is
                pressable, because nothing here is a real invite. */}
            <div className="flex gap-2 p-3" aria-hidden>
              <span className={buttonVariants({ variant: "brand", block: true })}>Accept</span>
              <span className={buttonVariants({ variant: "outline", block: true })}>
                Name your rate
              </span>
            </div>
          </Proof>
        }
      />

      <Register
        items={[
          {
            n: "01",
            title: "You see the fee, and that it’s held",
            body: "Every invite says who the brand is, who is running it, what they want, when it is due, and that the money for you is already in escrow. If it isn’t, we don’t message you.",
            proof: (
              <Proof label="Before you decide">
                <Line k="The brief" sub="What to say, what not to say, the disclosure tag" />
                <Line k="The agency" sub="Company name and verification, so you know who you are dealing with" />
                <Line k="The schedule" sub="Draft due, post due, paid by — as dates, not promises" />
              </Proof>
            ),
          },
          {
            n: "02",
            title: "Your rate, not theirs",
            body: "Ask for a different fee. The brand answers within a ceiling they set, and we email you either way — including when the answer is no, so you can take other work.",
            proof: (
              <Proof label="Rate">
                <Line k="Offered" v="₦100,000" tone="muted" />
                <Line k="You asked" v="₦120,000" />
                <Line k="Agreed" sub="Terms sent to you in full" v="₦120,000" tone="ok" />
              </Proof>
            ),
          },
          {
            n: "03",
            title: "A real contract, and a bank transfer",
            body: "Sign on your phone. Upload the draft, post when it is approved, and the money goes to the account you verified — the full fee, with ₦0 taken from you.",
            proof: (
              <Proof label="Payout">
                <Line k="Live, verified" v="22 Sep" />
                <Line k="Released" v="23 Sep" />
                <Line k="GTBank ···· 4417" v="₦120,000" tone="strong" />
              </Proof>
            ),
          },
        ]}
      />

      <section className="border-t border-line">
        <div className="mx-auto grid w-full max-w-[1180px] gap-8 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
          <div>
            <Display as="h2" size="l" className="max-w-[18ch]">
              Already have a brand? Bring the deal.
            </Display>
            <p className="mt-4 max-w-[46ch] text-[16.5px] leading-relaxed text-ink-2">
              Send them a SubSquad link. They pay into escrow, you deliver, you
              are paid. The brand pays 6% on top; you pay nothing.
            </p>
            <Button variant="outline" size="lg" className="mt-6" asChild>
              <Link href="/login">
                Start a deal <ArrowRight />
              </Link>
            </Button>
          </div>
          <Proof label="Your own deal">
            <Line k="Creator fee" v="₦180,000" />
            <Line k="SubSquad fee, 6%" sub="Paid by the brand" v="₦10,800" tone="muted" />
            <Line k="Brand pays into escrow" v="₦190,800" tone="strong" />
            <Line k="You receive" v="₦180,000" tone="ok" />
          </Proof>
        </div>
      </section>

      <Closing
        title="Your deals are waiting."
        primary={{ href: "/login", label: "Sign in" }}
        note="Invites arrive by email from a brand’s shortlist. Keep your handle public."
      />
    </>
  );
}
