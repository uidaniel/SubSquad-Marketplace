"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { requestPasswordReset, type ResetRequestResult } from "../actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="brand" size="lg" block disabled={pending}>
      {pending && <Loader2 className="animate-spin" />}
      Send the link
    </Button>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState<ResetRequestResult, FormData>(
    requestPasswordReset,
    undefined,
  );

  // The same screen whether or not the address exists. Saying "no account with
  // that email" would let anyone check which of their targets use the platform.
  if (state && "sent" in state) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-line bg-surface p-5">
        <span className="grid size-10 place-items-center rounded-[10px] bg-ok-soft">
          <MailCheck className="size-5 text-ok" />
        </span>
        <p className="mt-3 text-[15px] font-medium">Check your email</p>
        <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">
          If there is an account for <b className="font-medium text-ink">{state.email}</b>,
          a reset link is on its way. Nothing after a couple of minutes? Check
          spam, then try again.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <Field label="Email" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          required
          placeholder="you@agency.ng"
        />
      </Field>

      {state && "error" in state && (
        <p
          role="alert"
          className="rounded-[var(--radius-sm)] bg-danger-soft px-3 py-2.5 text-[13px] text-danger"
        >
          {state.error}
        </p>
      )}

      <Submit />
    </form>
  );
}
