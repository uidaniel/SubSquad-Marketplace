import { Eye } from "lucide-react";
import { Hero } from "@/components/marketing/pieces";
import {
  Avatar,
  Card,
  Chip,
  ClosingPoster,
  Faq,
  Feature,
  Kpis,
  Row,
  Section,
  SectionHead,
  Steps,
} from "@/components/marketing/blocks";

export const metadata = {
  title: "For agencies",
  description:
    "One login. A separate escrow wallet for every client. Your margin on top, hidden if you want it hidden.",
};

/**
 * The launch customer. The page is about the two things an agency loses
 * sleep over — money that must never mix, and a margin the client must never
 * see — and about how little of their team's time a campaign should take.
 */
export default function ForAgenciesPage() {
  return (
    <>
      <Hero
        eyebrow="For agencies · our first customer"
        title={
          <>
            Deliver more campaigns with <span className="text-brand-ink">the team you already have.</span>
          </>
        }
        lede="One login. A separate escrow wallet for every client. Your margin on top, hidden if you want it hidden. SubSquad is your execution layer — never your competitor."
        primary={{ href: "/signup", label: "Start a campaign" }}
        secondary={{ href: "/pricing", label: "See what it costs" }}
        ticks={["A wallet per client", "Your margin, not shown", "We run the first one with you"]}
        aside={
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
              <span>
                <b className="block text-[14.5px] font-semibold">Konga Digital</b>
                <span className="text-[12.5px] text-ink-3">5 client spaces · 3 live campaigns</span>
              </span>
              <Chip tone="warn">3 need you</Chip>
            </div>
            <div className="p-5">
              <ul className="divide-y divide-line">
                {[
                  ["PP", "info", "PalmPay", "Detty December · shortlist", "₦4,500,000"],
                  ["SS", "warn", "Sweet Sensation", "Jollof Week · content", "₦1,440,000"],
                  ["CW", "ok", "Cowrywise", "Save Your December · funding", "₦0"],
                ].map(([i, tone, name, meta, amt]) => (
                  <li key={name} className="flex items-center gap-3 py-2.5">
                    <Avatar initials={i} tone={tone as "info" | "warn" | "ok"} size={28} />
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[14px] font-semibold">{name}</b>
                      <span className="block truncate text-[12.5px] text-ink-3">{meta}</span>
                    </span>
                    <span className="text-[14px] font-semibold tabular-nums">{amt}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 rounded-[var(--radius-md)] bg-ink/[0.035] px-4 py-2">
                <Row k="Held across all clients" v="₦5,727,200" />
                <Row k="Available in wallets" v="₦1,060,000" tone="ok" />
              </div>
            </div>
          </Card>
        }
      />

      <Section>
        <SectionHead
          eyebrow="What it removes"
          title={
            <>
              Same team. <span className="text-brand-ink">Less of it spent chasing.</span>
            </>
          }
          lede="A thirty-creator campaign used to cost an account executive weeks of messages. Here it costs them the decisions, and nothing else."
        />
        <Kpis
          items={[
            { n: "3", note: "decisions per campaign: the shortlist, the content, the release." },
            { n: "1", note: "wallet per client. Their money never touches another client’s." },
            { n: "0", note: "accounts your clients need. They see a report, not a login." },
            { n: "12", suffix: "%", note: "only when a deal completes. Nothing monthly, nothing per seat." },
          ]}
        />
      </Section>

      <Section tight>
        <Feature
          eyebrow="Client spaces"
          title="A wall between every client’s money."
          lede="Each client gets its own wallet, briefs, campaign history and creator notes. Clients are labels, not logins — they never need an account."
          ticks={[
            "Budgets can never cross between clients — the ledger will not allow it.",
            "Team seats, with per-client access.",
            "One board shows every campaign across every client.",
          ]}
          proof={
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
                <b className="text-[14.5px] font-semibold">Margin control</b>
                <Chip tone="info">Per campaign</Chip>
              </div>
              <div className="p-5">
                <Row k="Creator fees, 15 deals" v="₦3,214,000" />
                <Row k="Your margin, 15%" v="₦482,100" tone="ok" />
                <Row k="SubSquad fee, 12%" v="₦385,680" />
                <Row k="Invoiced to PalmPay" v="₦4,081,780" total />
                <div className="mt-4 rounded-[var(--radius-md)] bg-ink/[0.035] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[14px]">Show margin in the client view</span>
                    <span className="relative h-[26px] w-11 shrink-0 rounded-full bg-ink/15">
                      <span className="absolute left-[3px] top-[3px] size-5 rounded-full bg-white shadow-panel" />
                    </span>
                  </div>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-ink-3">
                    Off by default. Your client sees creator fees and results — never what you charge on top.
                  </p>
                </div>
              </div>
            </Card>
          }
        />
      </Section>

      <Section tight>
        <Feature
          reverse
          eyebrow="Client view"
          title={
            <>
              Your client sees the work. <span className="text-brand-ink">Not your margin.</span>
            </>
          }
          lede="The client report shows the shortlist, the approved content and the results — without your margin, without creator contact details, and without your private notes."
          ticks={["Results and receipts, per campaign and per creator.", "Nothing you would rather they didn’t see."]}
          proof={
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
                <span>
                  <b className="block text-[14.5px] font-semibold">Client view</b>
                  <span className="text-[12.5px] text-ink-3">What PalmPay sees</span>
                </span>
                <Chip tone="ok">Read-only</Chip>
              </div>
              <ul className="divide-y divide-line px-5 py-2 text-[14px]">
                {[
                  ["Shortlist and fit reasoning", true],
                  ["Draft content and approvals", true],
                  ["Live posts and results", true],
                  ["Your margin", false],
                  ["Creator contact details", false],
                  ["Your private notes and tags", false],
                ].map(([label, shown]) => (
                  <li key={String(label)} className="flex items-center gap-3 py-2.5">
                    <span className={shown ? "text-ok" : "text-danger"}>{shown ? "✓" : "—"}</span>
                    <span className="flex-1">{label}</span>
                    <span className="text-[12.5px] text-ink-3">{shown ? "Visible" : "Hidden"}</span>
                  </li>
                ))}
              </ul>
            </Card>
          }
        />
      </Section>

      <Section tight>
        <Feature
          eyebrow="Creator memory"
          title={
            <>
              What your team knows, <span className="text-brand-ink">kept.</span>
            </>
          }
          lede="Private notes and tags on any creator, reused across every client. When your best account exec leaves, the knowledge doesn’t leave with them."
          ticks={["Never visible to creators or clients.", "Your history with a creator sits on their profile: delivered, on time, cancelled."]}
          proof={
            <Card className="p-6">
              <div className="flex items-center gap-3">
                <Avatar initials="CO" tone="info" size={44} />
                <span className="min-w-0 flex-1">
                  <b className="block text-[16px] font-semibold">Chidera Okonkwo</b>
                  <span className="text-[12.5px] text-ink-3">@chideraskits · TikTok · Lagos</span>
                </span>
                <Chip tone="ok">Score 92</Chip>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {["Great for fintech", "Fast turnaround", "Pidgin delivery", "Rebook"].map((t) => (
                  <span key={t} className="rounded-full border border-line bg-surface-2 px-3 py-1 text-[12.5px] font-medium">
                    {t}
                  </span>
                ))}
              </div>
              <div className="mt-4 space-y-2">
                <div className="rounded-[var(--radius-md)] bg-ink/[0.035] p-4">
                  <p className="text-[12px] font-semibold text-ink-2">Ada N. · 12 Aug 2026</p>
                  <p className="mt-1 text-[14px] leading-relaxed">
                    Delivered a day early on Jollof Week. Asks good questions about the brief before shooting.
                  </p>
                </div>
                <div className="rounded-[var(--radius-md)] bg-ink/[0.035] p-4">
                  <p className="text-[12px] font-semibold text-ink-2">Tobi A. · 3 Jun 2026</p>
                  <p className="mt-1 text-[14px] leading-relaxed">Late once in May — told us in advance. Not a pattern.</p>
                </div>
              </div>
              <p className="mt-3 text-[12.5px] text-ink-3">Private to Konga Digital. Creators and clients never see this.</p>
            </Card>
          }
        />
      </Section>

      <Section>
        <SectionHead
          eyebrow="The first one"
          title={
            <>
              We run the first one <span className="text-brand-ink">with you.</span>
            </>
          }
        />
        <Steps
          items={[
            { t: "01", title: "Pick one live client campaign", body: "A real brief with a real deadline — not a test." },
            { t: "02", title: "We sit in for the first run", body: "Founders alongside your account exec while it runs. You keep the client and the margin." },
            { t: "03", title: "You keep the dashboard", body: "No lock-in, no subscription. If it didn’t save you time, you’ve paid nothing but 12% on deals that completed." },
          ]}
        />
        <Card className="mt-6 flex flex-wrap items-start gap-5 p-6">
          <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-ok-soft text-ok">
            <Eye className="size-5" />
          </span>
          <div className="min-w-[260px] flex-1">
            <h3 className="text-[17px] font-semibold tracking-[-0.01em]">SubSquad stays invisible unless you say otherwise</h3>
            <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">
              Your client never has to know which tool you use. Creators are written to in the brand&rsquo;s name, and
              the client report carries the campaign, not us.
            </p>
          </div>
        </Card>
      </Section>

      <Section tight>
        <Faq
          eyebrow="Questions"
          title={
            <>
              Agency <span className="text-brand-ink">questions.</span>
            </>
          }
          items={[
            {
              q: "Are you going to compete with us for our clients?",
              a: "No. We don’t produce content, set strategy or buy media, and we never contact your client. Our revenue is the 12% on deals you run — your volume is our business model.",
            },
            { q: "Do our clients need accounts?", a: "No. Clients are spaces inside your account, not users. They get a report." },
            { q: "Can we set a different margin per client?", a: "Per campaign, even. You set it when you launch, and it is never shown to creators." },
            {
              q: "Who holds the money?",
              a: "Escrow is held per client space in naira, funded by you through Paystack by card or bank transfer. A cancelled campaign returns its escrow to that client’s wallet at once.",
            },
            {
              q: "What if a creator we already work with is not in your index?",
              a: "Add them by handle. They get the same funded proposal, sign the same contract, and keep working with you — now with guaranteed payment behind it.",
            },
            { q: "Can we export our data?", a: "Campaign reports export today. CSV export of creator notes and campaign history is on the list." },
          ]}
        />
      </Section>

      <ClosingPoster
        title={
          <>
            Run your next client campaign
            <br />
            without the chasing.
          </>
        }
        lede="We run the first campaign alongside your team. You keep the client, the margin and the dashboard."
        primary={{ href: "/signup", label: "Start a campaign" }}
        secondary={{ href: "/pricing", label: "See what it costs" }}
        trust={[
          { icon: "ban", label: "No subscription" },
          { icon: "shield", label: "12% only when a deal completes" },
          { icon: "lock", label: "A wallet per client" },
        ]}
      />
    </>
  );
}
