"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { KeyRound, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import {
  Panel,
  PanelBody,
  PanelFooter,
  PanelHeader,
  PanelTitle,
} from "@/components/ui/panel";
import {
  changePassword,
  signOutEverywhereElse,
  type AuthResult,
} from "@/app/(auth)/actions";

/**
 * The two things a person does about their account when something feels off.
 *
 * Neither existed. An owner whose laptop went missing had no way to change a
 * password or end the sessions on it — on an account that can release a
 * client's money.
 */
export function SecurityPanel({ email }: { email: string }) {
  const [state, action] = useActionState<AuthResult, FormData>(changePassword, undefined);
  const [saved, setSaved] = React.useState(false);
  const [everywhere, setEverywhere] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (state === undefined) return;
    if (!("error" in (state as object))) setSaved(true);
  }, [state]);

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Security</PanelTitle>
      </PanelHeader>
      <PanelBody className="grid gap-6 lg:grid-cols-2">
        <form action={action} className="space-y-4">
          <p className="text-[13.5px] font-medium">Change your password</p>
          <p className="-mt-2 text-[12.5px] text-ink-2">
            Signed in as {email}. Other devices are signed out when you change it.
          </p>
          <Field label="New password" hint="At least 8 characters." htmlFor="new-password">
            <Input
              id="new-password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </Field>
          <Field label="Type it again" htmlFor="new-password-confirm">
            <Input
              id="new-password-confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </Field>
          {state?.error && (
            <p role="alert" className="text-[12.5px] text-danger">
              {state.error}
            </p>
          )}
          {saved && !state?.error && (
            <p role="status" className="text-[12.5px] text-ok">
              Changed. Every other device has been signed out.
            </p>
          )}
          <SubmitButton />
        </form>

        <div className="space-y-3 border-t border-line pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <p className="text-[13.5px] font-medium">Sign out everywhere else</p>
          <p className="text-[12.5px] leading-relaxed text-ink-2">
            Ends every session except this one. Do this if a phone or laptop
            with SubSquad open on it is no longer in your hands.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const r = await signOutEverywhereElse();
              setEverywhere(r?.error ?? "Done. Only this device is still signed in.");
            }}
          >
            <LogOut /> Sign out other devices
          </Button>
          {everywhere && (
            <p role="status" className="text-[12.5px] text-ink-2">
              {everywhere}
            </p>
          )}
        </div>
      </PanelBody>
      <PanelFooter>
        Locked out instead? Sign out and use &ldquo;Forgot it?&rdquo; on the sign-in
        screen.
      </PanelFooter>
    </Panel>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <KeyRound />}
      Change password
    </Button>
  );
}
