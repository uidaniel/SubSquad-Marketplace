"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { formatNaira, parseNairaInput } from "@/lib/money";
import {
  acceptInvite,
  counterOffer,
  declineInvite,
  type ActionResult,
} from "./actions";

/**
 * The three things a creator can do with an invite.
 *
 * Accept is the only one that looks like a button worth pressing. Countering and
 * declining are real options, not dark-patterned away — a creator who feels
 * trapped into a rate does the work resentfully or not at all — but they are
 * quieter, because most of the time the offer is already inside their band.
 */
export function InviteActions({
  token,
  feeKobo,
  rateBandMaxKobo,
}: {
  token: string;
  feeKobo: number;
  rateBandMaxKobo: number | null;
}) {
  const [view, setView] = React.useState<"choose" | "counter" | "decline">(
    "choose",
  );
  const [result, setResult] = React.useState<ActionResult>(undefined);

  if (view === "counter") {
    return (
      <CounterForm
        token={token}
        feeKobo={feeKobo}
        rateBandMaxKobo={rateBandMaxKobo}
        onBack={() => setView("choose")}
      />
    );
  }

  if (view === "decline") {
    return (
      <DeclineForm
        token={token}
        onBack={() => setView("choose")}
      />
    );
  }

  return (
    <>
      {result && "error" in result && (
        <p
          role="alert"
          className="mb-2 rounded-[var(--radius-sm)] bg-danger-soft px-3 py-2 text-[12.5px] text-danger"
        >
          {result.error}
        </p>
      )}

      <form action={async () => setResult(await acceptInvite(token))}>
        <AcceptButton feeKobo={feeKobo} />
      </form>

      <div className="mt-2 flex gap-2">
        <Button variant="outline" block onClick={() => setView("counter")}>
          Ask for more
        </Button>
        <Button variant="ghost" block onClick={() => setView("decline")}>
          Not for me
        </Button>
      </div>
    </>
  );
}

function AcceptButton({ feeKobo }: { feeKobo: number }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="brand" size="lg" block disabled={pending}>
      {pending && <Loader2 className="animate-spin" />}
      Accept — {formatNaira(feeKobo)}
    </Button>
  );
}

/**
 * A counter-offer.
 *
 * The rate band is not shown — that is the agency's negotiating position and
 * publishing it would simply move every counter to the ceiling. What the creator
 * gets instead is an honest expectation: a fast yes inside the band, a person
 * looking at it above.
 */
function CounterForm({
  token,
  feeKobo,
  rateBandMaxKobo,
  onBack,
}: {
  token: string;
  feeKobo: number;
  rateBandMaxKobo: number | null;
  onBack: () => void;
}) {
  const [amount, setAmount] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);
  const parsed = parseNairaInput(amount);

  if (sent) {
    return (
      <div className="space-y-3 py-1 text-center">
        <p className="text-[13.5px] text-ink-2">
          Sent. {rateBandMaxKobo !== null && parsed !== null && parsed <= rateBandMaxKobo
            ? "Counters in this range usually get an answer the same day."
            : "Someone will look at it and come back to you on WhatsApp."}
        </p>
        <button
          type="button"
          onClick={onBack}
          className="w-full text-center text-[13px] text-ink-2 underline underline-offset-4"
        >
          Back to the offer
        </button>
      </div>
    );
  }
  const tooLow = parsed !== null && parsed <= feeKobo;
  const wayOver =
    parsed !== null && rateBandMaxKobo !== null && parsed > rateBandMaxKobo * 2;

  return (
    <div className="space-y-3">
      <Field label="What would you charge?" htmlFor="counter">
        <Input
          id="counter"
          inputMode="numeric"
          autoFocus
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={String(feeKobo / 100 + 20_000)}
          className="tabular-nums"
        />
      </Field>

      {tooLow && (
        <p className="text-[12.5px] text-warn">
          That is at or below what is already offered. Accept it instead?
        </p>
      )}
      {wayOver && (
        <p className="text-[12.5px] text-ink-2">
          That is well above what this brand has budgeted — expect a no, or a
          counter back.
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-[var(--radius-sm)] bg-danger-soft px-3 py-2 text-[12.5px] text-danger"
        >
          {error}
        </p>
      )}

      <form
        action={async () => {
          // Countering opens a conversation rather than changing the deal: a
          // person at the agency approves any number before it becomes an offer.
          const result = await counterOffer(token, parsed ?? 0);
          if (result && "error" in result) setError(result.error);
          else setSent(true);
        }}
      >
        <Button
          type="submit"
          variant="brand"
          size="lg"
          block
          disabled={parsed === null || tooLow}
        >
          Send my counter
        </Button>
      </form>

      <p className="text-center text-[12px] text-ink-3">
        Countering costs you nothing and does not cancel the offer.
      </p>

      <button
        type="button"
        onClick={onBack}
        className="w-full text-center text-[13px] text-ink-2 underline underline-offset-4"
      >
        Back
      </button>
    </div>
  );
}

function DeclineForm({ token, onBack }: { token: string; onBack: () => void }) {
  const [done, setDone] = React.useState(false);
  const [reason, setReason] = React.useState("");

  if (done) {
    return (
      <p className="py-2 text-center text-[13.5px] text-ink-2">
        Thanks for telling us. We will not chase you about this one.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <Field
        label="Anything we should know?"
        hint="Optional. It helps us send you better-matched deals."
        htmlFor="reason"
      >
        <Input
          id="reason"
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Not my kind of brand"
        />
      </Field>

      <form
        action={async () => {
          await declineInvite(token, reason);
          setDone(true);
        }}
      >
        <Button type="submit" variant="outline" size="lg" block>
          Decline this deal
        </Button>
      </form>

      <button
        type="button"
        onClick={onBack}
        className="w-full text-center text-[13px] text-ink-2 underline underline-offset-4"
      >
        Back
      </button>
    </div>
  );
}
