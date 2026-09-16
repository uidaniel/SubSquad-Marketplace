"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { signUp, type AuthResult } from "../actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="brand" size="lg" block disabled={pending}>
      {pending && <Loader2 className="animate-spin" />}
      Continue
    </Button>
  );
}

/**
 * Step one of two.
 *
 * Only the person is created here. What company they are — agency or brand,
 * and everything that follows from it — is asked next, because the answer
 * changes the whole shape of the account and is worth a screen of its own
 * rather than a radio button in a long form.
 */
export function SignupForm() {
  const [state, action] = useActionState<AuthResult, FormData>(signUp, undefined);

  return (
    <form action={action} className="space-y-4">
      <Field label="Your name" htmlFor="name">
        <Input
          id="name"
          name="name"
          autoComplete="name"
          autoFocus
          required
          placeholder="Ada Nwosu"
        />
      </Field>

      <Field label="Work email" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@agency.ng"
        />
      </Field>

      <Field label="Password" hint="At least 8 characters." htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          placeholder="••••••••"
        />
      </Field>

      {state?.error && (
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
