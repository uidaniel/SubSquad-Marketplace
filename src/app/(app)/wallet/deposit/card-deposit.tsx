"use client";

import * as React from "react";
import { CreditCard, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, MoneyInput, Select } from "@/components/ui/field";
import { formatNaira, parseNairaInput } from "@/lib/money";
import { startCardDeposit } from "./checkout-actions";

const MINIMUM_KOBO = 100_000; // ₦1,000 — below this the card fee dominates

/**
 * Paying in by card.
 *
 * The alternative on this page is recording a bank transfer that already
 * happened, which is how most Nigerian agencies actually pay. Card is for the
 * cases where waiting on a transfer is the thing blocking a campaign — usually
 * a foreign brand, or an agency topping up an hour before a deadline.
 *
 * Nothing is credited here. The button hands off to Paystack and the wallet
 * moves when their webhook confirms the charge, which means closing the tab
 * mid-payment loses nothing and a browser claiming success proves nothing.
 */
export function CardDeposit({
  spaces,
}: {
  spaces: { id: string; name: string; availableKobo: number }[];
}) {
  const [spaceId, setSpaceId] = React.useState(spaces[0]?.id ?? "");
  const [amountText, setAmountText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const amountKobo = parseNairaInput(amountText);
  const belowMinimum = amountKobo !== null && amountKobo < MINIMUM_KOBO;
  const valid = amountKobo !== null && amountKobo >= MINIMUM_KOBO && Boolean(spaceId);

  async function pay() {
    if (!valid || amountKobo === null) return;
    setBusy(true);
    setError(null);

    const result = await startCardDeposit({ spaceId, amountKobo });

    if ("error" in result) {
      setError(result.error);
      setBusy(false);
      return;
    }

    // Paystack's own page, not an embedded form: card details never touch this
    // origin, which is the whole reason the compliance burden stays theirs.
    window.location.href = result.authorizationUrl;
  }

  return (
    <div className="space-y-5">
      <Field label="Which client" htmlFor="card-space">
        <Select
          id="card-space"
          value={spaceId}
          onChange={(e) => setSpaceId(e.target.value)}
        >
          {spaces.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} — {formatNaira(s.availableKobo)} available
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Amount"
        hint="Paid by card or transfer on Paystack's page. Your wallet updates when the payment clears."
        htmlFor="card-amount"
        error={
          amountText && amountKobo === null
            ? "Enter an amount, like 500,000"
            : undefined
        }
      >
        <MoneyInput
          id="card-amount"
          value={amountText}
          onChange={(e) => setAmountText(e.target.value)}
          placeholder="500,000"
        />
      </Field>

      {belowMinimum && (
        <p className="rounded-[var(--radius-sm)] bg-warn-soft px-3 py-2.5 text-[12.5px] text-warn">
          The smallest card deposit is {formatNaira(MINIMUM_KOBO)}.
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-[var(--radius-sm)] bg-danger-soft px-3 py-2.5 text-[13px] leading-relaxed text-danger"
        >
          {error}
        </p>
      )}

      <Button
        variant="brand"
        size="lg"
        block
        disabled={!valid || busy}
        onClick={pay}
      >
        {busy ? <Loader2 className="animate-spin" /> : <CreditCard />}
        {amountKobo && valid
          ? `Pay ${formatNaira(amountKobo)}`
          : "Continue to payment"}
      </Button>

      <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-ink-3">
        <Lock className="mt-0.5 size-3.5 shrink-0" />
        You pay on Paystack&apos;s page — card details never reach SubSquad. The
        wallet updates when the payment clears, so closing the tab mid-payment
        loses nothing.
      </p>
    </div>
  );
}
