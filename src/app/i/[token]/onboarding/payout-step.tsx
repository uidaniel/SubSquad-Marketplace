"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import type { Bank } from "@/lib/payouts/banks";
import type { OnboardingState } from "@/lib/data/onboarding";
import {
  lookUpAccount,
  savePayoutAccount,
  type ActionResult,
  type ResolveState,
} from "../actions";

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="brand" size="lg" block disabled={pending}>
      {pending && <Loader2 className="animate-spin" />}
      {children}
    </Button>
  );
}

/**
 * Where the money goes.
 *
 * The account number is resolved to a name before anything is saved, and the
 * creator confirms the name they are shown. That one extra tap catches the
 * commonest cause of a failed payout — a mistyped digit — at the moment it is
 * cheap to fix, rather than a week later when the work is done and the transfer
 * bounces.
 */
export function PayoutStep({
  state,
  banks,
}: {
  state: OnboardingState;
  banks: Bank[];
}) {
  const router = useRouter();
  const [resolved, resolveAction] = useActionState<ResolveState, FormData>(
    lookUpAccount,
    undefined,
  );
  const [saved, saveAction] = useActionState<ActionResult, FormData>(
    savePayoutAccount,
    undefined,
  );

  React.useEffect(() => {
    if (saved && "ok" in saved) router.refresh();
  }, [saved, router]);

  const found = resolved && "ok" in resolved ? resolved : null;

  return (
    <>
      <h1 className="text-[22px] font-semibold tracking-[-0.02em]">
        Where should we pay you?
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
        A bank account or mobile wallet in your own name. We check the name
        before saving it, so a wrong digit does not cost you a week.
      </p>

      <form action={resolveAction} className="mt-6 space-y-4">
        <Field label="Bank or wallet" htmlFor="bankCode">
          <select
            id="bankCode"
            name="bankCode"
            required
            defaultValue={state.payoutBankCode ?? ""}
            className="h-11 w-full rounded-[var(--radius-sm)] border border-line-strong bg-surface px-3 text-[15px] outline-none focus-visible:border-ink"
          >
            <option value="" disabled>
              Choose your bank
            </option>
            {banks.map((bank) => (
              <option key={bank.code} value={bank.code}>
                {bank.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Account number" htmlFor="accountNumber">
          <Input
            id="accountNumber"
            name="accountNumber"
            inputMode="numeric"
            pattern="\d{10}"
            maxLength={10}
            required
            defaultValue={state.payoutAccountNumber ?? ""}
            placeholder="0123456789"
            className="tabular-nums"
          />
        </Field>

        {resolved && "error" in resolved && (
          <p
            role="alert"
            className="rounded-[var(--radius-sm)] bg-danger-soft px-3 py-2.5 text-[13px] text-danger"
          >
            {resolved.error}
          </p>
        )}

        {!found && (
          <Button type="submit" variant="outline" size="lg" block>
            Check the name
          </Button>
        )}
      </form>

      {found && (
        <form action={saveAction} className="mt-4 space-y-4">
          <input type="hidden" name="token" value={state.token} />
          <input type="hidden" name="bankCode" value={found.bankCode} />
          <input type="hidden" name="accountNumber" value={found.accountNumber} />
          <input type="hidden" name="accountName" value={found.accountName} />
          <input type="hidden" name="verified" value={String(found.verified)} />

          <div
            className={
              found.verified
                ? "rounded-[var(--radius-md)] border border-ok/30 bg-ok-soft p-4"
                : "rounded-[var(--radius-md)] border border-warn/30 bg-warn-soft p-4"
            }
          >
            <p className="flex items-center gap-2 text-[12.5px] font-medium">
              {found.verified ? (
                <>
                  <Check className="size-4 text-ok" />
                  <span className="text-ok">This account belongs to</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="size-4 text-warn" />
                  <span className="text-warn">Could not check this account</span>
                </>
              )}
            </p>
            <p className="mt-1.5 text-[17px] font-semibold">
              {found.accountName}
            </p>
            <p className="mt-1 text-[12.5px] text-ink-2">
              {found.verified
                ? "If that is not you, go back and check the number."
                : "Bank verification is not switched on yet, so nobody has confirmed this name."}
            </p>
          </div>

          {saved && "error" in saved && (
            <p
              role="alert"
              className="rounded-[var(--radius-sm)] bg-danger-soft px-3 py-2.5 text-[13px] text-danger"
            >
              {saved.error}
            </p>
          )}

          <Submit>Yes, pay me here</Submit>

          <button
            type="button"
            onClick={() => router.refresh()}
            className="w-full text-center text-[13px] text-ink-2 underline underline-offset-4"
          >
            That is not me — change the account
          </button>
        </form>
      )}
    </>
  );
}
