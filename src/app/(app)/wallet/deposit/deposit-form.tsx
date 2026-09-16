"use client";

import * as React from "react";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, MoneyInput, Select } from "@/components/ui/field";
import { formatNaira, parseNairaInput } from "@/lib/money";
import { cn } from "@/lib/utils";
import { recordDeposit } from "../../actions";

const MINIMUM_KOBO = 15_000_000; // ₦150,000 — the minimum campaign

export function DepositForm({
  spaces,
}: {
  spaces: { id: string; name: string; availableKobo: number }[];
}) {
  const [spaceId, setSpaceId] = React.useState(spaces[0]?.id ?? "");
  const [amountText, setAmountText] = React.useState("");
  const [reference, setReference] = React.useState("");
  const [result, setResult] = React.useState<{ ok: boolean; message: string } | null>(
    null,
  );
  const [pending, startTransition] = React.useTransition();

  const amountKobo = parseNairaInput(amountText);
  const belowMinimum = amountKobo !== null && amountKobo < MINIMUM_KOBO;
  const valid = amountKobo !== null && amountKobo > 0 && reference.trim() && spaceId;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    startTransition(async () => {
      const outcome = await recordDeposit(spaceId, amountText, reference);
      setResult(outcome);
      if (outcome.ok) {
        setAmountText("");
        setReference("");
      }
    });
  };

  const selected = spaces.find((s) => s.id === spaceId);

  return (
    <form onSubmit={submit} className="space-y-5">
      <Field label="Which client" htmlFor="space">
        <Select
          id="space"
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
        label="Amount received"
        hint={`A campaign needs at least ${formatNaira(MINIMUM_KOBO)} to run.`}
        htmlFor="amount"
        error={
          amountText && amountKobo === null
            ? "Enter an amount, like 500,000"
            : undefined
        }
      >
        <MoneyInput
          id="amount"
          value={amountText}
          onChange={(e) => setAmountText(e.target.value)}
          placeholder="500,000"
        />
      </Field>

      {belowMinimum && (
        <p className="rounded-[var(--radius-sm)] bg-warn-soft px-3 py-2.5 text-[12.5px] leading-relaxed text-warn">
          This is under the {formatNaira(MINIMUM_KOBO)} minimum campaign. It will
          still be added to the wallet — it just cannot fund a campaign on its own.
        </p>
      )}

      <Field
        label="Bank reference"
        hint="From the transfer. This is what the deposit is reconciled against, and it stops the same payment being recorded twice."
        htmlFor="reference"
      >
        <Input
          id="reference"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="e.g. FT26091612345"
        />
      </Field>

      {amountKobo !== null && amountKobo > 0 && selected && (
        <div className="rounded-[var(--radius-lg)] border border-line bg-surface p-4 text-[13.5px]">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-ink-2">{selected.name} holds now</span>
            <span className="tabular-nums">{formatNaira(selected.availableKobo)}</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-ink pt-2.5">
            <span className="font-medium">After this deposit</span>
            <span className="text-[18px] font-semibold tabular-nums">
              {formatNaira(selected.availableKobo + amountKobo)}
            </span>
          </div>
        </div>
      )}

      {result && (
        <p
          role="status"
          className={cn(
            "rounded-[var(--radius-sm)] px-3 py-2.5 text-[13px] leading-relaxed",
            result.ok ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger",
          )}
        >
          {result.message}
        </p>
      )}

      <Button type="submit" variant="brand" size="lg" block disabled={!valid || pending}>
        {pending && <Loader2 className="animate-spin" />}
        Record this deposit
      </Button>

      <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-ink-3">
        <Lock className="mt-0.5 size-3.5 shrink-0" />
        Recording a deposit writes a double-entry transaction, so the wallet
        balance on every screen is recomputed from this movement rather than
        edited. A repeated reference is refused rather than added twice.
      </p>
    </form>
  );
}
