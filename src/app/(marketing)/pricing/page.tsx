import { Closing, Display, Eyebrow, Receipt, Wrap } from "@/components/marketing/pieces";

export const metadata = {
  title: "Pricing",
  description:
    "12% on top of the creator’s fee when a campaign deal completes. 6% when a creator brings the deal. ₦0 for creators.",
};

const ROWS = [
  {
    figure: "12%",
    title: "Campaigns you run",
    body: "On top of the creator’s fee, charged when the deal completes. A cancelled campaign returns its escrow to your wallet in full.",
  },
  {
    figure: "6%",
    title: "A deal a creator brings you",
    body: "On top of the creator’s fee, paid by the brand at checkout. No account needed to pay.",
  },
  {
    figure: "₦0",
    title: "Creators",
    body: "The full fee that was agreed, to a Nigerian bank account, in naira.",
  },
] as const;

const QA = [
  {
    q: "When am I charged?",
    a: "When the post is verified live and the payout releases. Not at funding, not at signing.",
  },
  {
    q: "What if a creator does not deliver?",
    a: "Nothing is released. The deal is cancelled and the money stays in your wallet for the next one.",
  },
  {
    q: "How do I pay in?",
    a: "By card through Paystack, or by bank transfer recorded against your wallet. Everything is held in naira.",
  },
  {
    q: "Is there a minimum?",
    a: "No. Fund what the campaign needs.",
  },
] as const;

/**
 * Two numbers and a worked example. The page exists so nobody has to ask.
 */
export default function PricingPage() {
  return (
    <>
      <section className="py-14 sm:py-20">
        <Wrap className="grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start">
          <div>
            <Eyebrow>Pricing</Eyebrow>
            <Display as="h1" size="xl" className="mt-4 max-w-[12ch]">
              Two numbers. Nothing hidden.
            </Display>
            <dl className="mt-10 divide-y divide-line border-y border-line">
              {ROWS.map((row) => (
                <div
                  key={row.figure}
                  className="grid gap-2 py-6 sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-8"
                >
                  <dt className="font-display text-[36px] font-semibold leading-none tracking-[-0.03em] tabular-nums">
                    {row.figure}
                  </dt>
                  <dd>
                    <p className="text-[17px] font-semibold">{row.title}</p>
                    <p className="mt-1 max-w-[46ch] text-[15.5px] leading-relaxed text-ink-2">
                      {row.body}
                    </p>
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <Receipt
            title="Worked example"
            amount="₦112,000"
            caption="What you pay for one deal at a ₦100,000 creator fee"
            lines={[
              { label: "Creator fee", value: "₦100,000" },
              { label: "SubSquad fee, 12%", value: "₦12,000" },
            ]}
            totals={[
              { label: "You pay", value: "₦112,000", tone: "strong" },
              { label: "Creator receives", value: "₦100,000" },
              { label: "Charged when", value: "verified live", tone: "muted" },
            ]}
          />
        </Wrap>
      </section>

      <section className="border-t border-line">
        <Wrap className="py-14 sm:py-20">
          <dl className="grid gap-x-10 gap-y-8 md:grid-cols-2">
            {QA.map((item) => (
              <div key={item.q}>
                <dt className="text-[17px] font-semibold">{item.q}</dt>
                <dd className="mt-2 max-w-[44ch] text-[15.5px] leading-relaxed text-ink-2">
                  {item.a}
                </dd>
              </div>
            ))}
          </dl>
        </Wrap>
      </section>

      <Closing
        title="Start with one campaign."
        primary={{ href: "/signup", label: "Start a campaign" }}
        note="Free to set up. You pay when a deal completes."
      />
    </>
  );
}
