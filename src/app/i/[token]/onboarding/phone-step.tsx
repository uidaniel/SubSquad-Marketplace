"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { formatNigerianPhone } from "@/lib/payouts/format";
import type { OnboardingState } from "@/lib/data/onboarding";
import {
  confirmCode,
  requestCode,
  type ActionResult,
  type CodeResult,
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
 * Verifying the number.
 *
 * The number we already hold is pre-filled, because we got it from their public
 * bio and it is usually right — but it is editable, because sometimes it is the
 * number of whoever runs their page.
 *
 * The code goes over WhatsApp, which is where they came from and where the rest
 * of the deal will happen.
 */
export function PhoneStep({ state }: { state: OnboardingState }) {
  const router = useRouter();
  const [sent, sendAction] = useActionState<CodeResult | undefined, FormData>(
    requestCode,
    undefined,
  );
  const [confirmed, confirmAction] = useActionState<ActionResult, FormData>(
    confirmCode,
    undefined,
  );

  React.useEffect(() => {
    if (confirmed && "ok" in confirmed) router.refresh();
  }, [confirmed, router]);

  const codeSent = sent && "ok" in sent;

  return (
    <>
      {/* Say where the code actually went.
          This screen promised WhatsApp whatever happened, so on a deployment
          running email-only it told people to check an app nothing had been
          sent to — and then blamed their number when it failed. */}
      <h1 className="text-[22px] font-semibold tracking-[-0.02em]">
        {codeSent ? "Enter the code" : "Confirm your phone number"}
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
        {codeSent
          ? sent.sentTo === "whatsapp"
            ? `We sent a 6-digit code to ${formatNigerianPhone(sent.phone)} on WhatsApp.`
            : "We sent a 6-digit code to your email — the same address this invite came to."
          : "We need a number for reminders and for the message when your money goes out. One code, once."}
      </p>

      {!codeSent ? (
        <form action={sendAction} className="mt-6 space-y-4">
          <input type="hidden" name="token" value={state.token} />
          <Field label="Phone number" htmlFor="phone">
            <Input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              autoFocus
              required
              defaultValue={state.phone ? formatNigerianPhone(state.phone) : ""}
              placeholder="0803 000 4471"
            />
          </Field>

          {sent && "error" in sent && (
            <p
              role="alert"
              className="rounded-[var(--radius-sm)] bg-danger-soft px-3 py-2.5 text-[13px] text-danger"
            >
              {sent.error}
            </p>
          )}

          <Submit>
            <MessageCircle />
            Send me the code
          </Submit>
        </form>
      ) : (
        <form action={confirmAction} className="mt-6 space-y-4">
          <input type="hidden" name="token" value={state.token} />
          <input type="hidden" name="phone" value={sent.phone} />

          <Field label="6-digit code" htmlFor="code">
            <Input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              autoFocus
              required
              placeholder="000000"
              className="text-center text-[24px] tracking-[0.4em] tabular-nums"
            />
          </Field>

          {/* Only ever reachable with DRY_RUN on — with real credentials the
              code exists on the creator's phone and nowhere else. */}
          {sent.dryRun && sent.devCode && (
            <p className="rounded-[var(--radius-sm)] bg-warn-soft px-3 py-2.5 text-[13px] text-warn">
              Dry run — nothing was sent. Your code is{" "}
              <b className="tabular-nums">{sent.devCode}</b>.
            </p>
          )}

          {confirmed && "error" in confirmed && (
            <p
              role="alert"
              className="rounded-[var(--radius-sm)] bg-danger-soft px-3 py-2.5 text-[13px] text-danger"
            >
              {confirmed.error}
            </p>
          )}

          <Submit>Verify</Submit>

          <button
            type="button"
            onClick={() => router.refresh()}
            className="w-full text-center text-[13px] text-ink-2 underline underline-offset-4"
          >
            Use a different number
          </button>
        </form>
      )}

      <p className="mt-6 text-[12.5px] leading-relaxed text-ink-3">
        We never ask you for this code. Anybody who does is not us.
      </p>
    </>
  );
}
