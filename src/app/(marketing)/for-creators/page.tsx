import { Ban, Eye, Smartphone, Wallet } from "lucide-react";
import { Hero } from "@/components/marketing/pieces";
import {
  Avatar,
  Card,
  Chip,
  ClosingPoster,
  Faq,
  Feature,
  KeepDrop,
  Promises,
  Row,
  Section,
  SectionHead,
} from "@/components/marketing/blocks";

export const metadata = {
  title: "For creators",
  description:
    "Every invite already paid into escrow. You see the exact amount held before you accept, and you get paid within seven days of posting.",
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
        eyebrow="For creators · free forever"
        title={
          <>
            The money is there <span className="text-brand-ink">before you say yes.</span>
          </>
        }
        lede="Every invite we send you is already paid into escrow. You see the exact amount held before you accept anything, and you get paid within seven days of posting. We never charge a creator a naira."
        primary={{ href: "/login", label: "Sign in to your deals" }}
        secondary={{ href: "/legal/creator-agreement", label: "Read the creator agreement" }}
        ticks={["₦0 taken from your fee", "A real contract, every time", "Paid to your bank, in naira"]}
        aside={
          <Card className="p-6 text-center">
            <Avatar initials="SS" tone="warn" size={64} />
            <p className="mt-3 text-[13px] text-ink-2">Sweet Sensation wants a TikTok from you</p>
            <p className="mt-1.5 font-display text-[44px] font-semibold leading-none tracking-[-0.035em] tabular-nums">₦60,000</p>
            <p className="mt-1.5 text-[12.5px] text-ink-3">1 TikTok video · due 24 Sep</p>
            <div className="mt-3">
              <Chip tone="ok">Already in escrow</Chip>
            </div>
            <div className="mt-5 border-t border-line pt-2 text-left">
              <Row k="You receive" v="₦60,000" />
              <Row k="SubSquad takes from you" v="₦0" tone="ok" />
              <Row k="Paid within" v="7 days of posting" />
            </div>
          </Card>
        }
      />

      <Section>
        <SectionHead
          eyebrow="Why this is different"
          title={
            <>
              You&rsquo;ve heard it all before. <span className="text-brand-ink">Here&rsquo;s the difference.</span>
            </>
          }
        />
        <KeepDrop
          dropTitle="What usually happens"
          drop={[
            ["“We’ll pay after it performs”", "Two months later, maybe"],
            ["“Great exposure for you”", "₦0"],
            ["Brand goes quiet after delivery", "Nothing you can do"],
            ["No contract", "Nothing to enforce"],
            ["Rate negotiated from zero", "Every single time"],
          ]}
          keepTitle="On SubSquad"
          keep={[
            ["Money in escrow", "Before you’re contacted"],
            ["You see the amount", "Before you accept"],
            ["If the brand goes quiet", "The money is already held"],
            ["Contract", "On every deal"],
            ["Your rate", "Counter it in one tap"],
          ]}
        />
      </Section>

      <Section tight>
        <Feature
          eyebrow="Bring your own deal"
          title={
            <>
              A brand in your DMs? <span className="text-brand-ink">Make them pay first.</span>
            </>
          }
          lede="Tell us the brand, the work and your fee. We write the contract, send them a payment link, and hold the money until they approve your video. They don’t need an account. You don’t need to chase anyone."
          ticks={[
            "6% goes on top for the brand — you keep your full quote.",
            "They pay by card or transfer, without an account.",
            "The money is released to you when they approve the work.",
          ]}
          action={{ href: "/login", label: "Start a deal" }}
          proof={
            <Card className="p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <b className="text-[14.5px] font-semibold">New deal · Shea Farm Co.</b>
                <Chip tone="warn">Waiting for funds</Chip>
              </div>
              <Row k="Deliverable" v="2 Instagram reels" />
              <Row k="Your fee" v="₦180,000" />
              <Row k="SubSquad fee, 6%" v="₦10,800" />
              <Row k="Brand pays" v="₦190,800" total />
              <p className="mt-4 rounded-[var(--radius-md)] bg-ok-soft p-3.5 text-[13.5px] text-ok">
                You receive <b>₦180,000</b>, in full.
              </p>
            </Card>
          }
        />
      </Section>

      <Section>
        <SectionHead
          eyebrow="Our promises to you"
          title={
            <>
              Four things we <span className="text-brand-ink">won&rsquo;t do.</span>
            </>
          }
        />
        <Promises
          items={[
            {
              icon: <Wallet className="size-5" />,
              title: "We won’t take a cut of your fee",
              body: "Not now, not after we grow. Our fee comes from the brand. If your fee is ₦60,000, ₦60,000 reaches your account.",
            },
            {
              icon: <Ban className="size-5" />,
              title: "We won’t spam you",
              body: "One proposal a week at most. Every one is a funded offer with a real brand and a real fee — never “apply and maybe”.",
            },
            {
              icon: <Eye className="size-5" />,
              title: "We won’t score you in secret",
              body: "Your score always shows its reasons and its evidence. Every deduction is written down.",
            },
            {
              icon: <Smartphone className="size-5" />,
              title: "We won’t make you install anything",
              body: "Accept, counter, sign, upload, post and get paid from the one link we email you, on your phone.",
            },
          ]}
        />
      </Section>

      <Section tight>
        <Faq
          eyebrow="Questions"
          title={
            <>
              Straight <span className="text-brand-ink">answers.</span>
            </>
          }
          items={[
            {
              q: "Is this actually free for me?",
              a: "Yes. No subscription, no listing fee, no commission on your rate. Brands pay 12% on campaign deals and 6% on deals you bring in yourself, on top of your fee.",
            },
            {
              q: "How do I know the money is really there?",
              a: "Your deal page says the fee is held, before you accept. It is held by SubSquad, not the brand — they can’t pull it back once you’ve signed.",
            },
            {
              q: "What if the brand doesn’t like my video?",
              a: "They get one revision request per deliverable, and the draft was checked against their own brief before they saw it. Work that met the brief is paid.",
            },
            {
              q: "Can I say no, or ask for more money?",
              a: "Both. Decline with one tap, or counter the fee. The brand answers, and we email you either way. Declining doesn’t hurt your standing.",
            },
            {
              q: "What is the score and can it block me?",
              a: "A 0–100 score from how your following grew, whether comments read human, where your audience actually is, and whether you sit in an engagement pod. Below 60 you won’t appear on shortlists — but the reasons are written down.",
            },
            {
              q: "How fast do I actually get paid?",
              a: "Within 7 days of your post being verified live, to the bank account you verified at signing.",
            },
          ]}
        />
      </Section>

      <ClosingPoster
        title={
          <>
            Get real deals.
            <br />
            Get paid on time.
          </>
        }
        lede="Free forever. Every invite already funded. One message a week, at most."
        primary={{ href: "/login", label: "Sign in to your deals" }}
        secondary={{ href: "/login", label: "Bring your own deal" }}
        trust={[
          { icon: "lock", label: "Fee held before you’re contacted" },
          { icon: "shield", label: "A contract on every deal" },
          { icon: "ban", label: "₦0 taken from you" },
        ]}
      />
    </>
  );
}
