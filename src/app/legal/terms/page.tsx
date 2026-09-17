import Link from "next/link";

export const metadata = {
  title: "Terms of service",
  description:
    "The terms governing use of SubSquad by agencies and brands: escrow, fees, disputes, liability and Nigerian law.",
};

/**
 * Terms of service, for the paying side.
 *
 * The creator agreement covers the person doing the work. This covers the
 * agency or brand putting money in, and the two deliberately say the same
 * things about escrow — a platform whose terms and whose creator agreement
 * disagree about whose money it is has a problem it will discover in court.
 *
 * Written to be read rather than skimmed past. Where a clause protects us, it
 * says so, because a term hidden in a wall of text is one a Nigerian court may
 * decline to enforce anyway.
 */
export default function TermsPage() {
  return (
    <main className="mx-auto max-w-[44rem] px-5 py-12 sm:py-16">
      <p className="text-[12.5px] font-medium uppercase tracking-wide text-ink-3">
        SubSquad
      </p>
      <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.02em] sm:text-[34px]">
        Terms of service
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
        These govern your use of SubSquad as an agency or a brand. If you are a
        creator, the terms that apply to you are in the{" "}
        <Link
          href="/legal/creator-agreement"
          className="font-medium text-brand-ink underline underline-offset-2"
        >
          creator agreement
        </Link>
        .
      </p>

      <div className="mt-10 space-y-9">
        <Clause n="1" title="What SubSquad does">
          <p>
            SubSquad is the infrastructure between you and the creators you hire:
            it holds the money, records what was agreed, checks the work against
            the brief, and pays out when the work is verified live.
          </p>
          <p>
            We are not a party to your contract with a creator, and we are not
            your agent. The agreement to make and publish content is between you
            and them. What we guarantee is the money and the record.
          </p>
        </Clause>

        <Clause n="2" title="Escrow, and whose money it is">
          <p>
            Money you put into a wallet remains yours. Money moved into a
            campaign&apos;s escrow remains yours until it is released to a
            creator who has delivered. We do not lend it, invest it, or use it
            for anything else.
          </p>
          <p>
            Escrowed money is released only when a creator has published and we
            have verified the post, or when a dispute is decided in their favour.
            Anything not released returns to your wallet when the campaign is
            closed or cancelled.
          </p>
          <p>
            You can see every movement of every naira on your wallet page. It is
            a double-entry ledger — the balances are the sum of the movements,
            not a stored number that can drift.
          </p>
        </Clause>

        <Clause n="3" title="Our fee">
          <p>
            We charge a platform fee on each deal. It is shown on the funding
            screen before you commit anything, calculated on top of the creator
            fee, and taken when the creator is paid — not before.
          </p>
          <p>
            If a campaign is cancelled before any creator has been paid, we take
            nothing.
          </p>
        </Clause>

        <Clause n="4" title="What we do with your brief">
          <p>
            We use the brief you write to match creators, to draft outreach for
            you to approve, and to check submitted content. Drafts we produce are
            suggestions: nothing is sent to a creator and nothing is published
            without a named person on your side approving it.
          </p>
          <p>
            We do not use your brief, your campaign data or your results to
            train anybody else&apos;s models, and we do not show them to other
            accounts.
          </p>
        </Clause>

        <Clause n="5" title="Approving content">
          <p>
            Our review of a draft is a check against the brief and against
            Nigerian advertising rules. It is not legal advice and it is not a
            guarantee of compliance. You are the advertiser; the final judgement
            on whether content is right for your brand is yours.
          </p>
          <p>
            If you request a revision, say what needs to change. A rejection with
            no reason is not a revision request and we may treat the work as
            approved.
          </p>
        </Clause>

        <Clause n="6" title="Paying creators">
          <p>
            Once a creator publishes and we verify it, their fee is released
            automatically. You cannot withhold payment for work that matches the
            brief and is live — that is the promise that makes creators answer
            us, and it is the one thing we will not bend.
          </p>
          <p>
            If you believe work does not match the brief, raise a dispute before
            the verification window closes. See clause 8.
          </p>
        </Clause>

        <Clause n="7" title="Your account">
          <p>
            You are responsible for who you invite into your account and what
            they do. Anyone you make an admin can approve outreach and release
            money.
          </p>
          <p>
            Each client you add is walled off from the others. Clients never see
            each other, and never see your margin.
          </p>
          <p>
            We may ask you to verify your company registration before you move
            significant sums. We may suspend an account we believe is being used
            to defraud creators, and we will tell you why.
          </p>
        </Clause>

        <Clause n="8" title="Disputes">
          <p>
            Raise a dispute on the deal and a person at SubSquad will look at the
            brief, the work, and the messages, and decide. We will give you the
            reason, not just the outcome.
          </p>
          <p>
            We decide disputes about whether work matches a brief. We do not
            decide disputes about matters outside it, and nothing here removes
            either party&apos;s right to go to court.
          </p>
        </Clause>

        <Clause n="9" title="What we are liable for">
          <p>
            We are liable for the money we hold. If we lose it, mis-pay it, or
            release it to the wrong person through our own failure, we make it
            good.
          </p>
          <p>
            We are not liable for a campaign that underperforms, for a creator
            whose post does not go viral, or for indirect or consequential loss.
            Except for our handling of your money, our total liability is limited
            to the fees you have paid us in the preceding twelve months.
          </p>
          <p>
            Nothing here limits liability that cannot lawfully be limited,
            including for fraud.
          </p>
        </Clause>

        <Clause n="10" title="Ending it">
          <p>
            You can close your account whenever you like. Money in your wallets
            is returned; money in escrow on live deals stays there until those
            deals finish, because creators are relying on it.
          </p>
          <p>
            We keep the records of completed transactions. They are financial
            records we are required to hold.
          </p>
        </Clause>

        <Clause n="11" title="Changes">
          <p>
            If we change these terms we will tell you before they take effect.
            Campaigns already funded keep the terms in force when they were
            funded.
          </p>
        </Clause>

        <Clause n="12" title="Governing law">
          <p>
            These terms are governed by the laws of the Federal Republic of
            Nigeria, and the courts of Nigeria have jurisdiction.
          </p>
        </Clause>
      </div>

      <hr className="my-10 border-line" />

      <p className="text-[13.5px] leading-relaxed text-ink-3">
        Questions? Email{" "}
        <a
          href="mailto:hello@subsquad.ng"
          className="font-medium text-brand-ink underline underline-offset-2"
        >
          hello@subsquad.ng
        </a>
        . We would rather answer before you sign than argue afterwards.
      </p>

      <p className="mt-8 text-[13px]">
        <Link
          href="/"
          className="font-medium text-brand-ink underline underline-offset-2"
        >
          Back to SubSquad
        </Link>
      </p>
    </main>
  );
}

function Clause({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="flex gap-3 text-[17px] font-semibold leading-snug tracking-[-0.01em]">
        <span className="shrink-0 tabular-nums text-ink-3">{n}</span>
        <span>{title}</span>
      </h2>
      <div className="mt-2 space-y-3 text-[14.5px] leading-relaxed text-ink-2 sm:pl-8">
        {children}
      </div>
    </section>
  );
}
