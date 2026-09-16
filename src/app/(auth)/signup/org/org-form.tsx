"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Building2, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { createOrg, type AuthResult } from "../../actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="brand" size="lg" block disabled={pending}>
      {pending && <Loader2 className="animate-spin" />}
      Create the account
    </Button>
  );
}

/**
 * Agency or brand.
 *
 * Not a preference — the two accounts are genuinely different products. An
 * agency gets a wallet per client and a margin their clients never see; a brand
 * gets one wallet and no margin at all. Choosing wrong is annoying to undo, so
 * the difference is spelled out rather than hidden behind a label.
 */
export function OrgForm() {
  const [type, setType] = React.useState<"agency" | "brand">("agency");
  const [state, action] = useActionState<AuthResult, FormData>(createOrg, undefined);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="type" value={type} />

      <div className="space-y-2.5">
        <Choice
          selected={type === "agency"}
          onSelect={() => setType("agency")}
          icon={Users}
          title="We run campaigns for clients"
          body="A separate wallet per client, your margin on top, and a client view that never shows it."
        />
        <Choice
          selected={type === "brand"}
          onSelect={() => setType("brand")}
          icon={Building2}
          title="We are the brand"
          body="One wallet, your own campaigns, no margin and no client spaces to manage."
        />
      </div>

      <Field
        label={type === "agency" ? "Agency name" : "Brand name"}
        htmlFor="name"
      >
        <Input
          id="name"
          name="name"
          required
          placeholder={type === "agency" ? "Konga Digital" : "PalmPay"}
        />
      </Field>

      {type === "agency" && (
        <Field
          label="Your first client"
          hint="You can rename this or add more later. A wallet has to belong to somebody."
          htmlFor="firstSpaceName"
        >
          <Input id="firstSpaceName" name="firstSpaceName" placeholder="PalmPay" />
        </Field>
      )}

      <Field
        label="CAC number"
        hint="Checked against the register before you can fund a campaign. You can add it later."
        htmlFor="cacNumber"
      >
        <Input id="cacNumber" name="cacNumber" placeholder="RC 1234567" />
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

function Choice({
  selected,
  onSelect,
  icon: Icon,
  title,
  body,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex w-full gap-3 rounded-[var(--radius-md)] border p-3.5 text-left transition-colors",
        selected
          ? "border-ink bg-surface"
          : "border-line bg-surface hover:border-line-strong",
      )}
    >
      <span
        className={cn(
          "mt-0.5 grid size-8 shrink-0 place-items-center rounded-[9px]",
          selected ? "bg-ink text-white" : "bg-ground text-ink-2",
        )}
      >
        <Icon className="size-4" />
      </span>
      <span>
        <span className="block text-[14px] font-medium">{title}</span>
        <span className="block text-[12.5px] leading-snug text-ink-2">{body}</span>
      </span>
    </button>
  );
}
