"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNaira } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import type { OnboardingState } from "@/lib/data/onboarding";
import { acceptContract, type ActionResult } from "../actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="brand" size="lg" block disabled={pending}>
      {pending && <Loader2 className="animate-spin" />}
      Accept and sign
    </Button>
  );
}

/**
 * The contract.
 *
 * The same terms on every SubSquad deal, so a creator reads them once and knows
 * them forever. The five things that actually differ per deal — what, for whom,
 * for how much, by when, and for how long they can use it — are pulled out
 * above the legal text, because those are the terms anybody actually checks.
 */
export function ContractStep({ state }: { state: OnboardingState }) {
  const [result, action] = useActionState<ActionResult, FormData>(
    acceptContract,
    undefined,
  );

  const terms: [string, string][] = [
    ["Who", state.brandName],
    ["What", state.campaignName ?? "As agreed in your brief"],
    ["Your fee", formatNaira(state.feeKobo)],
    ["Post by", formatDate(state.deadline)],
    ["Paid", "Within 7 days of your post going live"],
    ["Usage rights", "90 days organic, on the brand's own channels"],
  ];

  return (
    <>
      <h1 className="text-[22px] font-semibold tracking-[-0.02em]">
        The contract
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
        Same terms on every SubSquad deal. Read it once — it does not change from
        deal to deal.
      </p>

      <dl className="mt-6 overflow-hidden rounded-[var(--radius-md)] border border-line bg-surface">
        {terms.map(([label, value], i) => (
          <div
            key={label}
            className={`flex items-baseline justify-between gap-4 px-4 py-3 ${
              i > 0 ? "border-t border-line" : ""
            }`}
          >
            <dt className="text-[13px] text-ink-2">{label}</dt>
            <dd className="text-right text-[13.5px] font-medium">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 space-y-3 rounded-[var(--radius-md)] bg-ground p-4 text-[13px] leading-relaxed text-ink-2">
        <p>
          <b className="text-ink">You deliver</b> what the brief asks for, by the
          date above, with <b className="text-ink">#Ad in the first line</b> of
          your caption — that is ARCON law here, not a SubSquad rule.
        </p>
        <p>
          <b className="text-ink">You get one revision request.</b> If your draft
          meets the brief and the brand still rejects it, our team reviews it and
          you are paid from the dispute reserve while that happens.
        </p>
        <p>
          <b className="text-ink">The money is already held.</b> It is released
          when your post is live and verified. If the brand disappears, you are
          still paid.
        </p>
        <p>
          <b className="text-ink">If you do not deliver</b>, the fee returns to
          the brand and the no-show goes on your public record.
        </p>
        <p>
          Governed by Nigerian law. The full agreement is at{" "}
          <a
            href="/legal/creator-agreement"
            className="font-medium text-brand-ink underline underline-offset-2"
          >
            subsquad.ng/legal
          </a>
          , and a PDF of this deal is sent to your WhatsApp once you sign.
        </p>
      </div>

      <form action={action} className="mt-5 space-y-4">
        <input type="hidden" name="token" value={state.token} />

        <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border border-line bg-surface p-4">
          <input
            type="checkbox"
            name="agreed"
            required
            className="mt-0.5 size-4 shrink-0 accent-[var(--color-ink)]"
          />
          <span className="text-[13.5px] leading-snug">
            I am {state.creatorName}, and I accept these terms.
          </span>
        </label>

        {result && "error" in result && (
          <p
            role="alert"
            className="rounded-[var(--radius-sm)] bg-danger-soft px-3 py-2.5 text-[13px] text-danger"
          >
            {result.error}
          </p>
        )}

        <Submit />
      </form>

      <p className="mt-4 text-center text-[12px] text-ink-3">
        Signed with your name, your verified number, the time, and your IP
        address.
      </p>
    </>
  );
}
