"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { updatePassword, type AuthResult } from "../actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="brand" size="lg" block disabled={pending}>
      {pending && <Loader2 className="animate-spin" />}
      Save and sign in
    </Button>
  );
}

export function ResetPasswordForm() {
  const [state, action] = useActionState<AuthResult, FormData>(updatePassword, undefined);

  return (
    <form action={action} className="space-y-4">
      <Field label="New password" hint="At least 8 characters." htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          autoFocus
          required
          placeholder="••••••••"
        />
      </Field>

      <Field label="Type it again" htmlFor="confirm">
        <Input
          id="confirm"
          name="confirm"
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
