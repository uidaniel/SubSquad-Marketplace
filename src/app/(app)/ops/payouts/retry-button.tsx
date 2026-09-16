"use client";

import * as React from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { retryPayout, type OpsResult } from "../actions";

/**
 * Sending it again.
 *
 * Disabled while the creator's details are still unverified: retrying against
 * the same wrong account number fails the same way and costs another transfer
 * fee. The button says what has to happen first rather than just going grey.
 */
export function RetryButton({
  payoutId,
  canRetry,
}: {
  payoutId: string;
  canRetry: boolean;
}) {
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<OpsResult | null>(null);

  if (result && "ok" in result) {
    return (
      <p className="shrink-0 text-[13.5px] font-medium text-ok lg:w-[240px]">
        {result.message}
      </p>
    );
  }

  return (
    <div className="shrink-0 space-y-2 lg:w-[240px]">
      <Button
        variant="default"
        size="sm"
        block
        disabled={busy || !canRetry}
        onClick={async () => {
          setBusy(true);
          setResult(await retryPayout(payoutId));
          setBusy(false);
        }}
      >
        {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />}
        Send it again
      </Button>

      {!canRetry && (
        <p className="text-[12px] leading-snug text-ink-3">
          Ask the creator to correct their account details first — retrying now
          fails the same way and costs another fee.
        </p>
      )}

      {result && "error" in result && (
        <p role="alert" className="text-[12.5px] text-danger">
          {result.error}
        </p>
      )}
    </div>
  );
}
