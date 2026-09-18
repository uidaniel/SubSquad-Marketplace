import { Briefcase, Building2, User } from "lucide-react";
import {
  Actionbar,
  CaseCards,
  ClosingPoster,
  Compare,
  Faq,
  Feature,
  Posters,
  PriceBand,
  ProductShot,
  ProposalCard,
  Rail,
  Reel,
  ReviewCard,
  ScoreCard,
  Section,
  SectionHead,
  Steps,
  Ticker,
  VideoHero,
  Ways,
} from "@/components/marketing/blocks";

export const metadata = {
  title: "SubSquad — Fund it. We run it. They get paid.",
};

/**
 * The landing page, in the shape of the design in design/screens/m-home.html:
 * a film hero with the budget bar, the product itself, a row of payouts, the
 * three decisions, the creator wall, three proofs, the price, the steps, three
 * campaigns by the numbers, the comparison, the doors, the questions, and one
 * closing poster. In ink, cream and tangerine only.
 *
 * Every number on this page is either a fact about the product or is
 * labelled as the demo workspace. Nothing is attributed to a company that has
 * not said it.
 */
export default function HomePage() {
  return (
    <>
      <VideoHero
        eyebrow="Creator campaigns · Nigeria"
        title={
          <>
            Fund it. We run it.
            <br />
            <span className="text-brand">They get paid.</span>
          </>
        }
        lede="Escrow-backed campaigns with verified Nigerian creators — matched, messaged, reviewed and paid out automatically."
        ticks={["Every creator fraud-scored", "100% held in escrow", "Creators paid within 7 days"]}
      >
        <Actionbar />
      </VideoHero>

      <ProductShot />

      <div className="h-16 sm:h-24" />
      <Ticker />

      <Rail
        label="Creators are paid to any Nigerian bank or wallet, in naira"
        items={["GTBank", "Access", "Zenith", "UBA", "First Bank", "OPay", "PalmPay", "Moniepoint", "Kuda", "Wema"]}
      />

      <Section>
        <SectionHead
          center
          eyebrow="How it runs"
          title={
            <>
              You make three decisions.
              <br />
              <span className="text-brand-ink">We do the rest.</span>
            </>
          }
        />
        <Posters
          items={[
            { n: "01", tone: "brand", title: "Approve the shortlist", body: "Ranked creators, each with a reason and a fraud score." },
            { n: "02", tone: "ink", title: "Approve the content", body: "You only see drafts that already passed the brief check." },
            { n: "03", tone: "cream", title: "Approve the release", body: "Escrow pays out. The report writes itself." },
          ]}
        />
      </Section>

      <Section tight>
        <SectionHead
          eyebrow="What a payout looks like"
          title={
            <>
              Real creators. <span className="text-brand-ink">Real payouts.</span>
            </>
          }
          lede={
            <>
              Every naira paid through SubSquad lands on the creator&rsquo;s own record. These six are the demo
              workspace. <span className="whitespace-nowrap text-ink-3">Scroll →</span>
            </>
          }
        />
        <Reel />
      </Section>

      <Section>
        <Feature
          eyebrow="Vetting"
          title={
            <>
              A score that <span className="text-brand-ink">shows its working.</span>
            </>
          }
          lede="Bought engagement is normal here. So every creator is scored before you see them — and again on every campaign."
          ticks={["Reasons, not a black-box match percentage.", "Every deduction shows its evidence, to both sides."]}
          proof={
            <ScoreCard
              handle="@chideraskits"
              meta="TikTok · Lagos · 128,400"
              initials="CO"
              tone="info"
              score={92}
              verdict="Cleared"
              verdictTone="ok"
              line="Ranked 1st of 412 profiles screened for this brief."
              checks={[
                { label: "Follower growth", detail: "no spikes", state: "ok", meter: 96 },
                { label: "Comment quality", detail: "reads human", state: "ok", meter: 91 },
                { label: "Geography", detail: "88% Nigeria", state: "ok", meter: 94 },
                { label: "Engagement pods", detail: "none", state: "ok", meter: 98 },
                { label: "Brand safety", detail: "2 alcohol mentions, 2024", state: "warn", meter: 78 },
              ]}
            />
          }
        />
      </Section>

      <Section tight>
        <Feature
          reverse
          eyebrow="Outreach"
          title={
            <>
              The first message is a proposal, <span className="text-brand-ink">not a pitch.</span>
            </>
          }
          lede="Creators are written to by email, in plain words, with the fee already held — and a human approves anything that goes out."
          ticks={[
            "Negotiates inside the ceiling you set.",
            "One proposal per creator, per week. Never spam.",
            "A person approves anything that moves money.",
          ]}
          proof={<ProposalCard />}
        />
      </Section>

      <Section tight>
        <Feature
          eyebrow="Content review"
          title={
            <>
              Bad drafts <span className="text-brand-ink">never reach you.</span>
            </>
          }
          lede="Every draft is checked against your brief first. The creator gets the fix-list, in their own words, before you see anything."
          ticks={["The disclosure tag is checked on the post itself.", "One revision request per deliverable, so nothing negotiates forever."]}
          proof={<ReviewCard />}
        />
      </Section>

      <PriceBand />

      <Section>
        <SectionHead
          eyebrow="Brief to payout"
          title={
            <>
              Brief to payout, <span className="text-brand-ink">start to finish.</span>
            </>
          }
          action={{ href: "/signup", label: "Skip it, start a campaign" }}
        />
        <Steps
          items={[
            { t: "Day 1", title: "Funding the budget", body: "Money into a wallet by card or bank transfer. Nothing is spent yet." },
            { t: "Day 1", title: "Writing the brief", body: "Typed in plain English. It becomes the checks every draft is measured against." },
            { t: "Day 2", title: "Approving the shortlist", body: "Ranked creators with reasons and scores. Remove anyone. Ask for more." },
            { t: "Day 2", title: "Outreach by email", body: "Proposals with the fee already held. Counters land in your approvals." },
            { t: "Day 6", title: "Reviewing a draft", body: "Only drafts that passed the brief check. One revision if you need it." },
            { t: "Day 9", title: "Payout lands", body: "The post is verified live. The creator is paid. A receipt on both sides." },
          ]}
        />
      </Section>

      <Section tight>
        <SectionHead
          eyebrow="Three campaigns, end to end"
          title={
            <>
              What a campaign <span className="text-brand-ink">looks like.</span>
            </>
          }
          lede="From the demo workspace — illustrative, so you can see the shape of a report before you have one of your own."
        />
        <CaseCards
          items={[
            {
              brand: "PalmPay",
              status: "Paid",
              statusTone: "ok",
              meta: "Fintech · Lagos & Abuja · demo",
              name: "Detty December",
              brief: "15 creators explaining free transfers before Christmas, none above ₦120,000.",
              stat: "9 days",
              statNote: "from funding the budget to all 15 posts live",
              rows: [
                ["Budget in escrow", "₦4,500,000"],
                ["Creators confirmed", "15 of 15"],
                ["Negotiated under the ceiling", "₦486,000", "ok"],
                ["Reach delivered", "1.84M"],
              ],
            },
            {
              brand: "Sweet Sensation",
              status: "Paid",
              statusTone: "ok",
              meta: "Food · nationwide · demo",
              name: "Jollof Week",
              brief: "12 food creators, 12 videos, one week — run by a team already at capacity.",
              stat: "3.5 hrs",
              statNote: "total time the account exec spent on the campaign",
              rows: [
                ["Creators confirmed", "12 of 12"],
                ["Reminders sent automatically", "47"],
                ["Passed review first time", "9 of 12", "ok"],
                ["Creators who dropped out", "0"],
              ],
            },
            {
              brand: "Cowrywise",
              status: "Live",
              statusTone: "info",
              meta: "Fintech · Lagos · demo",
              name: "Save Your December",
              brief: "The client had hand-picked a shortlist. It was scored before a naira moved.",
              stat: "₦640k",
              statNote: "budget kept back from three profiles with faked engagement",
              rows: [
                ["Profiles screened", "412"],
                ["On the client’s own shortlist", "18"],
                ["Scored below threshold", "3", "danger"],
                ["Appeals upheld", "0"],
              ],
            },
          ]}
        />
      </Section>

      <Section tight>
        <SectionHead
          center
          eyebrow="Why not a global platform"
          title={
            <>
              Nigeria isn&rsquo;t a smaller version of
              <br />
              <span className="text-brand-ink">someone else&rsquo;s market.</span>
            </>
          }
        />
        <Compare
          rows={[
            ["First contact", "Email, and hope", "A funded proposal — the fee is held before we write"],
            ["Discovery", "Millions of profiles, thin Nigerian data", "Nigeria-only index, scored for bought engagement"],
            ["Language", "English", "English, Pidgin, Yoruba, Igbo, Hausa in the brief and the drafts"],
            ["Payouts", "Card rails, dollars", "Naira to banks, OPay, PalmPay, Moniepoint"],
            ["Fraud detection", "Standard", "Weighted heavier — it has to be, here"],
            ["Agencies", "An afterthought", "Client wallets and a hidden margin at launch"],
            ["Seeing the price", "Book a demo", "It’s on this page"],
          ]}
        />
      </Section>

      <Section tight>
        <SectionHead
          center
          eyebrow="Three ways in"
          title={
            <>
              Built for the side <span className="text-brand-ink">you&rsquo;re on.</span>
            </>
          }
        />
        <Ways
          items={[
            {
              href: "/for-agencies",
              icon: <Briefcase className="size-5" />,
              title: "Agencies",
              body: "A separate escrow wallet per client, your margin on top, and a client view that never shows it.",
              cta: "The agency dashboard",
            },
            {
              href: "/for-brands",
              icon: <Building2 className="size-5" />,
              title: "Brands",
              body: "Launch this week without hiring an agency. One wallet, one brief, the same shortlist.",
              cta: "How brands run it",
            },
            {
              href: "/for-creators",
              icon: <User className="size-5" />,
              title: "Creators",
              body: "Every invite already funded. Bring your own brand deal and we will hold the money for you.",
              cta: "Get paid properly",
            },
          ]}
        />
      </Section>

      <Section>
        <Faq
          eyebrow="Questions"
          title={
            <>
              Straight <span className="text-brand-ink">answers.</span>
            </>
          }
          items={[
            {
              q: "What if a creator takes the money and disappears?",
              a: "They can’t. Nothing is released until the content is published and verified. The money stays in your wallet, and the no-show goes on their record.",
            },
            {
              q: "What if I don’t like the content?",
              a: "One revision request per deliverable — and the draft was already checked against your brief before you saw it.",
            },
            {
              q: "Do creators need an app?",
              a: "No. Everything happens from one link on their phone: accept, counter, sign, upload, post, get paid.",
            },
            {
              q: "How do you know the followers are real?",
              a: "A 0–100 score from growth anomalies, engagement outliers, comment quality, follower geography and pod detection. Below the threshold never reaches your shortlist, and every deduction shows its evidence.",
            },
            {
              q: "Can my agency stay invisible to our client?",
              a: "Yes. Your margin is never shown to creators, and the client report shows results and receipts — not what you charge on top.",
            },
            {
              q: "Where is the money held?",
              a: "In naira, per client wallet, with every movement on a double-entry ledger you can read in your wallet page. Paystack handles cards and transfers.",
            },
          ]}
        />
      </Section>

      <ClosingPoster
        eyebrow="Nigeria first"
        title={
          <>
            Fund a campaign.
            <br />
            Watch it run itself.
          </>
        }
        lede="Put a budget in escrow and have your first creator proposal out before the end of the day."
        primary={{ href: "/signup", label: "Start a campaign" }}
        secondary={{ href: "/for-agencies", label: "See how agencies use it" }}
        trust={[
          { icon: "ban", label: "No subscription" },
          { icon: "shield", label: "12% only when a deal completes" },
          { icon: "refresh", label: "Unused budget stays yours" },
          { icon: "lock", label: "Held in naira" },
        ]}
      />
    </>
  );
}
