"use client";

import * as React from "react";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNaira } from "@/lib/money";
import { startGuestPayment } from "./checkout-actions";

/**
 * The pay buttons on a guest brand's deal link.
 *
 * This is the whole creator-initiated revenue line, and both buttons were
 * inert. The person pressing them has no account and no relationship with us
 * beyond a link a creator sent, so a failure has to say plainly that nothing
 * was charged — otherwise the reasonable assumption is that money left and
 * vanished.
 */
export function PayButtons({
  token,
  outstandingKobo,
  halfKobo,
  showHalf,
  dryRun,
}: {
  token: string;
  outstandingKobo: number;
  halfKobo: number;
  showHalf: boolean;
  dryRun: boolean;
}) {
  const [busy, setBusy] = React.useState<"full" | "half" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function pay(portion: "full" | "half") {
    setBusy(portion);
    setError(null);
    const result = await startGuestPayment(token, portion);
    if ("error" in result) {
      setError(result.error);
      setBusy(null);
      return;
    }
    // Paystack's own page. Card details never touch this origin.
    window.location.href = result.authorizationUrl;
  }

  return (
    <>
      <Button
        variant="brand"
        size="lg"
        block
        disabled={busy !== null}
        onClick={() => pay("full")}
      >
        {busy === "full" ? <Loader2 className="animate-spin" /> : <Lock />}
        Pay {formatNaira(outstandingKobo)} into escrow
      </Button>

      {showHalf && (
        <Button
          variant="outline"
          block
          className="mt-2"
          disabled={busy !== null}
          onClick={() => pay("half")}
        >
          {busy === "half" && <Loader2 className="animate-spin" />}
          Pay half now — {formatNaira(halfKobo)}
        </Button>
      )}

      {error && (
        <p
          role="alert"
          className="mt-2 rounded-[var(--radius-sm)] bg-danger-soft px-3 py-2.5 text-[12.5px] leading-relaxed text-danger"
        >
          {error}
        </p>
      )}

      <p className="mt-2 text-center text-[12px] text-ink-3">
        Card, bank transfer or USSD via Paystack.
        {dryRun ? " Test mode — no card is charged." : ""}
      </p>
    </>
  );
}
