import { Closing, Display, Hero, Line, Proof, Register } from "@/components/marketing/pieces";

export const metadata = {
  title: "For agencies and brands",
  description:
    "Brief, shortlist, outreach, review and payout from one screen, with each client’s money held in its own wallet.",
};

/**
 * The launch customer is an agency running campaigns for several clients at
 * once, so the page is about the two things they lose sleep over: money that
 * must never mix, and a margin the client must never see.
 */
export default function ForAgenciesPage() {
  return (
    <>
      <Hero
        eyebrow="For agencies and brands"
        title={
          <>
            Deliver more campaigns with{" "}
            <span className="text-brand-ink">the team you already have.</span>
          </>
        }
        lede="Brief, shortlist, outreach, review and payout, run from one screen — with the money held where your client can see it and nowhere it shouldn’t be."
        primary={{ href: "/signup", label: "Start a campaign" }}
        secondary={{ href: "/pricing", label: "See what it costs" }}
        ticks={["A wallet per client", "Your margin, not shown", "Reminders and checks run without you"]}
      />

      <Register
        items={[
          {
            n: "01",
            title: "A wall between every client’s money",
            body: "Each client gets a wallet. Funds never pool, one client’s report never shows another’s numbers, and the ledger underneath is double-entry — the balances are sums of real movements, not a number somebody typed.",
            proof: (
              <Proof label="By client">
                <Line k="PalmPay" sub="Fintech" v="₦500,000" />
                <Line k="Sweet Sensation" sub="Food" v="₦560,000" />
                <Line k="Cowrywise" sub="Fintech" v="₦0" tone="muted" />
                <Line k="Airtel Nigeria" sub="Telco" v="₦0" tone="muted" />
              </Proof>
            ),
          },
          {
            n: "02",
            title: "Your client sees the work, not your margin",
            body: "Set a ceiling per creator. Creators name their rate against it and you accept, counter or decline in one place. The client’s report shows results and receipts.",
            proof: (
              <Proof label="Rates">
                <Line k="Max each" sub="Set by you, never shown to creators" v="₦150,000" tone="strong" />
                <Line k="@tundeexplains asked" sub="Accepted · terms sent" v="₦110,000" tone="ok" />
                <Line k="@zainabglow asked" sub="Countered at ₦88,000 · she decides next" v="₦95,000" />
              </Proof>
            ),
          },
          {
            n: "03",
            title: "Three decisions, then it runs",
            body: "Approve the shortlist. Approve the content. Release the payment. Outreach, reminders, brief checks and payouts happen without you — and the dashboard only ever shows what is waiting on you.",
            proof: (
              <Proof label="Needs your action">
                <Line k="Approve a shortlist of 5 creators" sub="PalmPay · escrow is funded and waiting" />
                <Line k="Review 1 draft that passed the brief check" sub="Sweet Sensation · creator is waiting on you" />
                <Line k="Everything else is running without you" sub="Outreach, reminders, content checks and payouts" tone="muted" />
              </Proof>
            ),
          },
        ]}
      />

      <section className="border-t border-line">
        <div className="mx-auto w-full max-w-[1180px] px-5 py-14 sm:px-8 sm:py-20">
          <Display as="h2" size="l" className="max-w-[22ch]">
            A direct brand? Same product, one wallet, no client switcher.
          </Display>
          <p className="mt-4 max-w-[52ch] text-[16.5px] leading-relaxed text-ink-2">
            Sign up as a brand and the agency parts get out of the way. You fund
            your own wallet, write the brief, and approve the same shortlist.
          </p>
        </div>
      </section>

      <Closing
        title="Run the first one this week."
        primary={{ href: "/signup", label: "Start a campaign" }}
        note="Set-up is free. 12% when a deal completes."
      />
    </>
  );
}
