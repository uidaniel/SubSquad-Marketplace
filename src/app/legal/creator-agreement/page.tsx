import Link from "next/link";

export const metadata = {
  title: "Creator agreement",
  description:
    "The terms a creator accepts when they take a SubSquad deal: how the fee is held, when it is paid, and what happens if something goes wrong.",
};

/**
 * The creator agreement.
 *
 * Public and unauthenticated on purpose. A creator is asked to accept this
 * during onboarding, before they have an account — and the onboarding screen
 * linked here while this page did not exist, so the one document they are asked
 * to agree to was a 404. Terms nobody can read are not terms.
 *
 * Written to be read on a phone by someone deciding whether to trust a stranger
 * with their work: short sentences, the money first, no defined-term glossary.
 */
export default function CreatorAgreementPage() {
  return (
    <main className="mx-auto max-w-[44rem] px-5 py-12 sm:py-16">
      <p className="text-[12.5px] font-medium uppercase tracking-wide text-ink-3">
        SubSquad
      </p>
      <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.02em] sm:text-[34px]">
        Creator agreement
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
        This is what you are agreeing to when you accept a deal on SubSquad. It
        is the whole agreement — there is nothing else you have to find.
      </p>

      <div className="mt-10 space-y-9">
        <Clause n="1" title="Who you are contracting with">
          <p>
            Your contract for each deal is with the brand or agency named on that
            deal, not with SubSquad. SubSquad holds the money, checks the work
            against the brief, and pays you. We are not your employer, and taking
            a deal does not make you an employee of anyone.
          </p>
        </Clause>

        <Clause n="2" title="The fee is held before you are contacted">
          <p>
            Nobody can invite you to a deal until the full fee is already in
            escrow. Escrow means the money has left the brand&apos;s wallet and
            cannot be spent on anything else. It is not our money and it is not
            the brand&apos;s to take back once you have delivered.
          </p>
          <p>
            The fee shown on your invite is the fee you receive. SubSquad&apos;s
            commission is charged to the brand on top of it, unless the deal
            screen says otherwise before you accept.
          </p>
        </Clause>

        <Clause n="3" title="When you get paid">
          <p>
            You are paid after your post is published and we have verified that
            it is live and matches what was agreed. Verification is usually
            within a day of publishing.
          </p>
          <p>
            Payment goes to the bank account you verified during onboarding.
            Transfers are made in Naira. We do not charge you a fee to be paid.
          </p>
        </Clause>

        <Clause n="4" title="What you are agreeing to deliver">
          <p>
            The deliverables, the deadline and the brief are on the deal screen
            before you accept. Accepting means you will produce that work by that
            date. If the brief changes afterwards, you are free to decline the
            change and keep the original terms, or to walk away.
          </p>
          <p>
            The brand may ask for revisions. The number of rounds included is on
            the deal screen. Revision requests must relate to the brief — not to
            a change of mind about what was asked for.
          </p>
        </Clause>

        <Clause n="5" title="Your work stays yours">
          <p>
            You keep ownership of what you make. By accepting a deal you give the
            brand a licence to use that specific content to promote the specific
            product named in the brief, on the platforms named in the brief, for
            the period named in the brief.
          </p>
          <p>
            If the deal screen does not name a period, the licence lasts twelve
            months from publication. Using your work beyond that, or for a
            different product, requires a new agreement and a new fee.
          </p>
        </Clause>

        <Clause n="6" title="Disclosure is not optional">
          <p>
            Paid content must be marked as paid. In Nigeria this is required by
            ARCON, and it is your name on the post. We check for it and will ask
            you to fix a post that is missing it before you are paid.
          </p>
          <p>
            Some categories — finance, alcohol, betting, health — carry extra
            rules. Where they apply, the deal screen says so before you accept.
          </p>
        </Clause>

        <Clause n="7" title="If you do not deliver">
          <p>
            If you accept a deal and then do not deliver by the deadline without
            agreeing a new one, the fee returns to the brand and the missed deal
            is recorded on your SubSquad profile. Repeatedly missing deals will
            stop you being matched to new ones.
          </p>
          <p>
            Life happens. Tell us before the deadline and we will try to move it
            — a deadline moved by agreement is not a missed deal.
          </p>
        </Clause>

        <Clause n="8" title="If the brand does not pay or disappears">
          <p>
            This is the situation SubSquad exists to remove. The money is already
            held before you start, so a brand that stops replying cannot take it
            back. If you delivered what was agreed and the brand goes silent, we
            release the fee to you.
          </p>
        </Clause>

        <Clause n="9" title="If there is a disagreement">
          <p>
            Raise it on the deal and a person at SubSquad will look at the brief,
            the work and the messages, and decide. We will tell you the reason,
            not just the outcome.
          </p>
          <p>
            If you disagree with our decision you are free to pursue the matter
            through the Nigerian courts. Nothing here removes that right.
          </p>
        </Clause>

        <Clause n="10" title="Your information">
          <p>
            We hold your name, contact details, social accounts, bank details and
            the record of your deals. Bank details are used to pay you and for no
            other purpose. We do not sell your data.
          </p>
          <p>
            Brands see your public profile and the deals you have done with them.
            They do not see your bank details, your other clients&apos; deals, or
            your contact details until you accept a deal with them.
          </p>
          <p>
            You can ask us to delete your account at any time. We keep the
            records of completed deals, because they are financial records we are
            required to hold.
          </p>
        </Clause>

        <Clause n="11" title="Changes to this agreement">
          <p>
            If we change these terms, deals you have already accepted keep the
            terms that were in force when you accepted them. Changes apply to new
            deals only, and we will tell you before they do.
          </p>
        </Clause>

        <Clause n="12" title="Governing law">
          <p>
            This agreement is governed by the laws of the Federal Republic of
            Nigeria.
          </p>
        </Clause>
      </div>

      <hr className="my-10 border-line" />

      <p className="text-[13.5px] leading-relaxed text-ink-3">
        Questions about any of this? Reply to any message from us, or email{" "}
        <a
          href="mailto:hello@subsquad.ng"
          className="font-medium text-brand-ink underline underline-offset-2"
        >
          hello@subsquad.ng
        </a>
        . We would rather answer before you accept than argue afterwards.
      </p>

      <p className="mt-8 text-[13px]">
        <Link
          href="/"
          className="font-medium text-brand-ink underline underline-offset-2"
        >
          Back to SubSquad
        </Link>
        {" · "}
        <Link
          href="/legal/terms"
          className="font-medium text-brand-ink underline underline-offset-2"
        >
          Terms of service
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
      <div className="mt-2 space-y-3 pl-0 text-[14.5px] leading-relaxed text-ink-2 sm:pl-8">
        {children}
      </div>
    </section>
  );
}
