import { Check } from "lucide-react";
import {
  Closing,
  Display,
  Doors,
  Figures,
  Hero,
  Line,
  Proof,
  Receipt,
  Register,
} from "@/components/marketing/pieces";

export const metadata = {
  title: "SubSquad — Fund it. We run it. They get paid.",
};

/**
 * The landing page.
 *
 * One idea per line. The hero says what happens; the receipt beside it shows
 * what it looks like when it has happened; three numbered steps say how; one
 * dark band says what it costs. Nobody has to scroll to find the price.
 */
export default function HomePage() {
  return (
    <>
      <Hero
        eyebrow="Creator campaigns · Nigeria"
        title={
          <>
            Fund it.
            <br />
            We run it.
            <br />
            <span className="text-brand-ink">They get paid.</span>
          </>
        }
        lede="Escrow-backed campaigns with verified Nigerian creators. Nobody is contacted until the money is there, and nobody is paid until the post is verified live."
        primary={{ href: "/signup", label: "Start a campaign" }}
        secondary={{ href: "/for-creators", label: "I’m a creator" }}
        ticks={["Money held before outreach", "Every creator fraud-scored", "Paid within 7 days of going live"]}
        aside={
          <Receipt
            title="Deal receipt"
            status="Paid"
            amount="₦120,000"
            caption="@hauwacooks · TikTok video for Sweet Sensation"
            lines={[
              { label: "Held in escrow", value: "12 Sep", tone: "done" },
              { label: "Draft approved", value: "19 Sep", tone: "done" },
              { label: "Live, verified", value: "22 Sep", tone: "done" },
              { label: "Paid to GTBank", value: "23 Sep", tone: "done" },
            ]}
            totals={[
              { label: "Fee to creator", value: "₦120,000" },
              { label: "SubSquad fee, 12%", value: "₦14,400", tone: "muted" },
              { label: "Brand paid", value: "₦134,400", tone: "strong" },
            ]}
            number="SS-0923-1141 · every deal ends in one of these"
          />
        }
      />

      <Register
        heading={
          <Display as="h2" size="l" className="max-w-[22ch]">
            Three steps. You make the decisions; we do the chasing.
          </Display>
        }
        items={[
          {
            n: "01",
            title: "Fund it",
            body: "Add money to a wallet. Nothing leaves it until you approve a shortlist, and nothing reaches a creator until their post is verified live.",
            proof: (
              <Proof label="Wallet">
                <Line k="Bank transfer from PalmPay" sub="Client wallet" v="+₦5,000,000" tone="ok" />
                <Line k="Funded Detty December" sub="Client wallet → Campaign escrow" v="−₦4,500,000" />
                <Line k="Available to spend" v="₦500,000" tone="strong" />
              </Proof>
            ),
          },
          {
            n: "02",
            title: "Approve the shortlist",
            body: "Write the brief in plain words. You get a shortlist with a reason under every name and a fraud score beside it. Nobody is contacted until you say so.",
            proof: (
              <Proof label="Shortlist">
                <Line
                  k="@chideraskits"
                  sub="Lagos skit creator. Three fintech collabs, all disclosed. Switches English and Pidgin in one video."
                  v="92"
                  tone="ok"
                />
                <Line k="@hauwacooks" sub="204k · 9.2% engagement · Abuja" v="96" tone="ok" />
                <Line k="@kemiglows" sub="Excluded — 72% of engagement outside Nigeria" v="34" tone="danger" />
              </Proof>
            ),
          },
          {
            n: "03",
            title: "They get paid",
            body: "Drafts are checked against your brief before you see them. The post is verified live. The creator is paid to their bank within 7 days, and you get the receipt.",
            proof: (
              <Proof label="Campaign">
                {[
                  ["Funded", "12 Sep"],
                  ["Shortlist approved", "13 Sep"],
                  ["Invites accepted", "14 Sep"],
                  ["Draft approved", "19 Sep"],
                  ["Live, verified", "22 Sep"],
                  ["Paid", "23 Sep"],
                ].map(([step, date]) => (
                  <Line
                    key={step}
                    k={
                      <span className="flex items-center gap-2">
                        <Check className="size-4 text-ok" aria-hidden />
                        {step}
                      </span>
                    }
                    v={date}
                    tone="muted"
                  />
                ))}
              </Proof>
            ),
          },
        ]}
      />

      <Figures
        items={[
          { figure: "12%", note: "on top of the creator’s fee. Charged when a deal completes. Nothing if it doesn’t." },
          { figure: "₦0", note: "for creators. They receive the full fee that was agreed." },
          { figure: "7 days", note: "from verified live to money in the creator’s bank." },
        ]}
      />

      <Doors
        items={[
          {
            href: "/for-agencies",
            title: "For agencies and brands",
            body: "One wallet per client, and a wall between every client’s money. Your margin stays yours.",
            cta: "How agencies use it",
          },
          {
            href: "/for-creators",
            title: "For creators",
            body: "The fee is held before we message you. Counter it, sign a real contract, get paid to your bank.",
            cta: "How it works for you",
          },
        ]}
      />

      <Closing
        title="Start with one campaign."
        primary={{ href: "/signup", label: "Start a campaign" }}
        note="Free to set up. You pay when a deal completes."
      />
    </>
  );
}
