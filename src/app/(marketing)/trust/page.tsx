import { FileText, Lock, Scale, Sparkles, User } from "lucide-react";
import { Display, Eyebrow, Wrap } from "@/components/marketing/pieces";
import {
  Card,
  ClosingPoster,
  Feature,
  Path,
  ScoreCard,
  Section,
  SectionHead,
} from "@/components/marketing/blocks";

export const metadata = {
  title: "Trust and escrow",
  description:
    "Where the money sits, who decides, and what happens when it goes wrong — written down so you can check it rather than trust us.",
};

/**
 * The whole mechanism, written down. Both sides of a creator deal have been
 * burned before; this page is for checking, not persuading.
 */
export default function TrustPage() {
  return (
    <>
      <section className="py-16 sm:py-24">
        <Wrap>
          <div className="max-w-[64ch]">
            <p data-hero>
              <Eyebrow>Trust and escrow</Eyebrow>
            </p>
            <Display as="h1" size="xl" className="mt-4 max-w-[14ch]" data-hero>
              Where the money sits, and <span className="text-brand-ink">who decides.</span>
            </Display>
            <p data-hero className="mt-6 text-[17px] leading-relaxed text-ink-2 sm:text-[18px]">
              Both sides of a creator deal have been burned before. This page is the whole mechanism written down —
              escrow, what happens when it goes wrong, fraud scoring, contracts and where the AI stops — so you can check
              it rather than trust us.
            </p>
          </div>
        </Wrap>
      </section>

      <Section tight>
        <Feature
          eyebrow="Escrow"
          title={
            <>
              Nobody holds the money <span className="text-brand-ink">but us.</span>
            </>
          }
          lede="A campaign is funded before a single creator is contacted. The brand can’t pull it back once a creator has signed, and the creator can’t touch it until their post is live and verified."
          ticks={[
            "Held per client wallet, in naira. It can’t move between clients.",
            "Released per deal, not per campaign.",
            "Every movement is a double-entry ledger row you can read in your wallet.",
          ]}
          proof={
            <Path
              title="The path of one fee"
              steps={[
                { title: "Brand funds ₦60,000", meta: "Held by SubSquad · 12 Sep" },
                { title: "Creator invited and accepts", meta: "Fee locked to a signed contract · 12 Sep" },
                { title: "Content approved, post goes live", meta: "Publish verified · 18 Sep" },
                { title: "₦60,000 released to the creator", meta: "Bank transfer · within 7 days", now: true },
              ]}
            />
          }
        />
      </Section>

      <Section>
        <SectionHead
          eyebrow="When it goes wrong"
          title={
            <>
              What happens when <span className="text-brand-ink">it goes wrong.</span>
            </>
          }
        />
        <div data-reveal-group className="grid gap-5 md:grid-cols-3">
          {[
            {
              icon: <User className="size-5" />,
              tone: "bg-danger-soft text-danger",
              title: "The creator doesn’t deliver",
              body: "Nothing is released. The deal is cancelled, the money stays in the brand’s wallet, and the no-show goes on the creator’s record. No argument, no ticket.",
            },
            {
              icon: <Scale className="size-5" />,
              tone: "bg-info-soft text-info",
              title: "The brand rejects good work",
              body: "The draft was checked against the brief before the brand saw it, and the check is on the record. Work that met the brief is paid, and the brand is shown which line of their own brief decided it.",
            },
            {
              icon: <Lock className="size-5" />,
              tone: "bg-ok-soft text-ok",
              title: "The brand cancels",
              body: "Deals not yet accepted close and their creators are told. Escrow returns to the brand’s wallet at once. A signed deal cannot be cancelled out from under a creator.",
            },
          ].map((c) => (
            <Card key={c.title} className="p-6">
              <span className={`grid size-11 place-items-center rounded-[14px] ${c.tone}`}>{c.icon}</span>
              <h3 className="mt-4 font-display text-[22px] font-semibold tracking-[-0.02em]">{c.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{c.body}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section tight>
        <Feature
          reverse
          eyebrow="Fraud scoring"
          title={
            <>
              Bought engagement is <span className="text-brand-ink">normal here.</span>
            </>
          }
          lede="So we weight fraud detection heavier than a global platform would, and we show our working. Nobody gets quietly blacklisted by a black box."
          ticks={[
            "Growth anomalies, engagement outliers, comment quality, follower geography, pod detection.",
            "Recomputed on every campaign — not once at onboarding.",
            "Every score shows its reasons and evidence, to both sides.",
          ]}
          proof={
            <ScoreCard
              handle="@kemiglows"
              meta="Instagram · 310,000 followers"
              initials="KE"
              tone="brand"
              score={34}
              verdict="Excluded"
              verdictTone="danger"
              line="310,000 followers, and almost none of them matter."
              checks={[
                { label: "Follower geography", detail: "72% outside Nigeria", state: "danger" },
                { label: "Comment quality", detail: "same text across 40 posts", state: "danger" },
                { label: "Growth pattern", detail: "three unexplained spikes", state: "warn" },
                { label: "Brand safety", detail: "nothing flagged", state: "ok" },
              ]}
              note="Scores are recomputed every campaign, so a bad month isn’t permanent. Every deduction is written down with its evidence."
            />
          }
        />
      </Section>

      <Section>
        <SectionHead
          eyebrow="Paperwork"
          title={
            <>
              The rules, <span className="text-brand-ink">inside the workflow.</span>
            </>
          }
        />
        <div data-reveal-group className="grid gap-5 md:grid-cols-3">
          {[
            {
              icon: <Scale className="size-5" />,
              title: "Disclosure",
              body: "Every brief carries its disclosure tag and its must-avoid list. The tag is checked on the draft and on the published post — not promised, checked.",
            },
            {
              icon: <Lock className="size-5" />,
              title: "Contact",
              body: "Creators are written to once, with a funded proposal, and not again for seven days. An opt-out is honoured at once, and a creator who has asked not to be contacted never appears on a shortlist.",
            },
            {
              icon: <FileText className="size-5" />,
              title: "Contracts",
              body: "A creator agreement on every deal — deliverables, usage rights, and payment terms. Signed on a phone with name, timestamp and IP, and it cannot be signed twice.",
            },
          ].map((c) => (
            <Card key={c.title} className="p-6">
              <span className="grid size-11 place-items-center rounded-[14px] bg-info-soft text-info">{c.icon}</span>
              <h3 className="mt-4 font-display text-[22px] font-semibold tracking-[-0.02em]">{c.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{c.body}</p>
            </Card>
          ))}
        </div>
        <Card flat className="mt-6 flex flex-wrap items-start gap-5 p-6" data-reveal>
          <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-brand/10 text-brand-ink">
            <Sparkles className="size-5" />
          </span>
          <div className="min-w-[260px] flex-1">
            <h3 className="text-[17px] font-semibold tracking-[-0.01em]">Where the AI stops</h3>
            <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">
              The AI drafts messages, scores creators and checks drafts against the brief. It never sends a message
              that commits money, and it never changes a contract term. A person approves the shortlist, the rate, the
              content and the release.
            </p>
          </div>
        </Card>
      </Section>

      <ClosingPoster
        title={
          <>
            Read it, then decide.
            <br />
            That is the point.
          </>
        }
        lede="Escrow and the record work the same whether you are paying or getting paid."
        primary={{ href: "/signup", label: "Start a campaign" }}
        secondary={{ href: "/legal/creator-agreement", label: "Read the contract" }}
        trust={[
          { icon: "lock", label: "Held in naira" },
          { icon: "shield", label: "Every score shows its evidence" },
          { icon: "refresh", label: "Cancelled escrow returns at once" },
        ]}
      />
    </>
  );
}
