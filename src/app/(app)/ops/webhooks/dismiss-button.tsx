"use client";

import * as React from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveWebhookProblem, type OpsResult } from "../actions";

/**
 * Marking one as handled.
 *
 * Deliberately says "handled" rather than "resolve": clicking this changes
 * nothing about the money. It records that a person looked at it and did
 * whatever was needed elsewhere.
 */
export function DismissButton({ id }: { id: string }) {
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<OpsResult | null>(null);

  if (result && "ok" in result) {
    return (
      <p className="shrink-0 text-[13.5px] font-medium text-ok lg:w-[200px]">
        Marked as handled.
      </p>
    );
  }

  return (
    <div className="shrink-0 space-y-2 lg:w-[200px]">
      <Button
        variant="outline"
        size="sm"
        block
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setResult(await resolveWebhookProblem(id));
          setBusy(false);
        }}
      >
        {busy ? <Loader2 className="animate-spin" /> : <Check />}
        I have handled this
      </Button>

      {result && "error" in result && (
        <p role="alert" className="text-[12.5px] text-danger">
          {result.error}
        </p>
      )}
    </div>
  );
}
