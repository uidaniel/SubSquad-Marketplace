import { Hero } from "@/components/marketing/pieces";
import {
  ClosingPoster,
  Faq,
  KeepDrop,
  Path,
  Posters,
  Section,
  SectionHead,
} from "@/components/marketing/blocks";

export const metadata = {
  title: "For brands",
  description:
    "No agency retainer, no two-week setup, no spreadsheet. Fund a budget, write a brief, approve a shortlist.",
};

/**
 * A brand running it directly. The same product as the agency page with the
 * agency parts out of the way: one wallet, one brief, three decisions.
 */
export default function ForBrandsPage() {
  return (
    <>
      <Hero
        eyebrow="For brands"
        title={
          <>
            Launch a creator campaign <span className="text-brand-ink">this week.</span>
          </>
        }
        lede="No agency retainer, no two-week setup, no spreadsheet. Fund a budget, write a brief, approve a shortlist. Your first proposal goes out the same day."
        primary={{ href: "/signup", label: "Fund your first campaign" }}
        secondary={{ href: "/pricing", label: "See what it costs" }}
        ticks={["12% when a deal completes", "Nothing if it doesn’t", "One wallet, one brief"]}
        aside={
          <Path
            title="Your first campaign, from signup to first proposal"
            steps={[
              { title: "Company created", meta: "Name, type, first wallet · 2 minutes" },
              { title: "₦1,500,000 funded", meta: "Bank transfer, recorded against the wallet · 4 minutes" },
              { title: "Brief written in plain English", meta: "Typed, not form-filled · 11 minutes" },
              { title: "Shortlist of 14 reviewed", meta: "2 removed, 12 approved · 26 minutes" },
              { title: "Outreach started", meta: "First proposal sent by email · now", now: true },
            ]}
          />
        }
      />

      <Section>
        <SectionHead
          center
          eyebrow="Instead of an agency"
          title={
            <>
              What you keep. <span className="text-brand-ink">What you drop.</span>
            </>
          }
        />
        <KeepDrop
          keepTitle="You keep"
          keep={[
            ["Creator quality", "Fraud-scored, every campaign"],
            ["Contracts", "On every deal"],
            ["Brief control", "Checked on every draft"],
            ["Final approval", "Always yours"],
            ["Reporting", "Reach, cost per creator, receipts"],
          ]}
          dropTitle="You drop"
          drop={[
            ["Monthly retainer", "Gone"],
            ["Two-week setup", "Gone"],
            ["Chasing creators", "Gone"],
            ["Opaque rates", "Gone"],
            ["A markup you can’t see", "Gone"],
          ]}
        />
      </Section>

      <Section tight>
        <SectionHead
          eyebrow="What you’d actually do"
          title={
            <>
              Three decisions. <span className="text-brand-ink">An afternoon.</span>
            </>
          }
        />
        <Posters
          items={[
            { n: "01", tone: "brand", title: "Approve the shortlist", body: "Ranked creators, each with a reason, a fraud score and the ceiling you set. Remove anyone. Ask for more." },
            { n: "02", tone: "ink", title: "Approve the content", body: "Only drafts that already passed your brief reach you. One revision each, so nothing negotiates forever." },
            { n: "03", tone: "cream", title: "Approve the release", body: "Publish is verified, escrow pays out, the report writes itself. Unused budget stays in your wallet." },
          ]}
        />
      </Section>

      <Section>
        <Faq
          eyebrow="Questions"
          title={
            <>
              Brand <span className="text-brand-ink">questions.</span>
            </>
          }
          items={[
            {
              q: "We already use an agency. Does this replace them?",
              a: "Not necessarily. Plenty of brands run some campaigns through their agency and some themselves. You can have your own brand account and be a client space inside your agency’s account at the same time.",
            },
            {
              q: "How do we know the creators are real?",
              a: "A 0–100 score built from growth anomalies, engagement outliers, comment quality, follower geography and pod detection. Below threshold never reaches your shortlist, and the score is recomputed for every campaign.",
            },
            {
              q: "What happens to unused budget?",
              a: "It stays in your wallet, available for the next campaign. A cancelled campaign returns its escrow to the wallet at once.",
            },
            {
              q: "Can we run a restricted category — betting, alcohol, financial products?",
              a: "Yes. The brief carries its disclosure and the must-avoid list, and every draft is checked against them before it reaches you.",
            },
            {
              q: "Who owns the content afterwards?",
              a: "The creator, licensed to you for the usage period in the brief — 90 days organic by default. It is written into the contract every creator signs.",
            },
          ]}
        />
      </Section>

      <ClosingPoster
        title={
          <>
            Your first campaign could be
            <br />
            live this week.
          </>
        }
        lede="Fund a budget, write a brief, approve a shortlist. We do the rest."
        primary={{ href: "/signup", label: "Create a brand account" }}
        secondary={{ href: "/pricing", label: "See what it costs" }}
        trust={[
          { icon: "ban", label: "No subscription" },
          { icon: "shield", label: "12% only when a deal completes" },
          { icon: "refresh", label: "Unused budget stays yours" },
        ]}
      />
    </>
  );
}
