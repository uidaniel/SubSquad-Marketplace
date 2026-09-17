"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateOrgSettings } from "../actions";

/**
 * Saving the account details.
 *
 * Wraps the fields that were already on the page — the inputs were rendered
 * with `defaultValue` and a Save button that did nothing, so anything typed was
 * lost on navigation. Reads the values out of the form on submit rather than
 * holding each in state, which keeps the server component's markup unchanged.
 */
export function OrgSettingsForm({
  children,
  canEdit,
}: {
  children: React.ReactNode;
  canEdit: boolean;
}) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setBusy(true);
    setResult(null);

    const marginRaw = form.get("margin");
    const outcome = await updateOrgSettings({
      name: String(form.get("name") ?? ""),
      cacNumber: String(form.get("cac") ?? ""),
      defaultMarginBps:
        marginRaw === null ? undefined : Number(marginRaw),
    });

    setBusy(false);
    setResult(outcome);
    if (outcome.ok) router.refresh();
  }

  return (
    <form ref={formRef} onSubmit={save} className="space-y-5">
      {children}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy || !canEdit}>
          {busy && <Loader2 className="animate-spin" />}
          Save changes
        </Button>

        {!canEdit && (
          <span className="text-[12.5px] text-ink-3">
            Only an owner or admin can change these.
          </span>
        )}

        {result && (
          <span
            role="status"
            className={`text-[12.5px] ${result.ok ? "text-ok" : "text-danger"}`}
          >
            {result.message}
          </span>
        )}
      </div>
    </form>
  );
}
