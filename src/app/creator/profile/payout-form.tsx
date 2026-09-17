"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import type { Bank } from "@/lib/payouts/banks";
import { lookUpMyAccount, saveMyPayoutAccount } from "./payout-actions";

/**
 * Where a creator's money goes.
 *
 * Two steps on purpose. The account number is looked up with the bank and the
 * name it returns is shown before anything is saved, because "is this really
 * your account?" answered by a machine beats the same question answered by
 * somebody typing carefully. A transfer to the wrong ten digits is gone.
 */
export function PayoutForm({
  banks,
  currentName,
  currentLast4,
  verified,
}: {
  banks: Bank[];
  currentName: string | null;
  currentLast4: string | null;
  verified: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(!currentLast4);
  const [bankCode, setBankCode] = React.useState(banks[0]?.code ?? "");
  const [accountNumber, setAccountNumber] = React.useState("");
  const [looked, setLooked] = React.useState<{
    accountName: string;
    verified: boolean;
  } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState<string | null>(null);

  const digits = accountNumber.replace(/\D/g, "");

  async function check() {
    setBusy(true);
    setError(null);
    const result = await lookUpMyAccount(bankCode, digits);
    setBusy(false);
    if (result.ok) setLooked(result);
    else setError(result.error);
  }

  async function save() {
    setBusy(true);
    setError(null);
    const result = await saveMyPayoutAccount({ bankCode, accountNumber: digits });
    setBusy(false);
    if ("message" in result) {
      setSaved(result.message);
      setEditing(false);
      setLooked(null);
      setAccountNumber("");
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  if (!editing) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13.5px] font-medium">
            {currentName ?? "Bank account"}
          </span>
          {currentLast4 && (
            <span className="text-[13px] text-ink-2 tabular-nums">
              ••••{currentLast4}
            </span>
          )}
          {verified && (
            <span className="inline-flex items-center gap-1 text-[12.5px] font-medium text-ok">
              <BadgeCheck className="size-3.5" /> Verified
            </span>
          )}
        </div>
        {saved && <p className="text-[12.5px] text-ok">{saved}</p>}
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Pencil /> Change bank account
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Field label="Bank" htmlFor="payout-bank">
        <Select
          id="payout-bank"
          value={bankCode}
          onChange={(e) => {
            setBankCode(e.target.value);
            setLooked(null);
          }}
        >
          {banks.map((bank) => (
            <option key={bank.code} value={bank.code}>
              {bank.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Account number"
        hint="Ten digits."
        htmlFor="payout-account"
        error={
          digits.length > 0 && digits.length !== 10
            ? "A Nigerian account number is 10 digits."
            : undefined
        }
      >
        <Input
          id="payout-account"
          inputMode="numeric"
          value={accountNumber}
          onChange={(e) => {
            setAccountNumber(e.target.value);
            setLooked(null);
          }}
          placeholder="0123456789"
        />
      </Field>

      {looked && (
        <div className="rounded-[var(--radius-sm)] bg-ok-soft px-3 py-2.5">
          <p className="text-[13px] font-medium text-ok">{looked.accountName}</p>
          <p className="mt-0.5 text-[12.5px] text-ink-2">
            Is that you? Payouts will go to this name.
          </p>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-[var(--radius-sm)] bg-danger-soft px-3 py-2.5 text-[13px] text-danger"
        >
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {looked ? (
          <Button disabled={busy} onClick={save}>
            {busy ? <Loader2 className="animate-spin" /> : <BadgeCheck />}
            Yes, that is me — save it
          </Button>
        ) : (
          <Button disabled={busy || digits.length !== 10} onClick={check}>
            {busy && <Loader2 className="animate-spin" />}
            Check the name
          </Button>
        )}
        {currentLast4 && (
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => {
              setEditing(false);
              setLooked(null);
              setError(null);
            }}
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
