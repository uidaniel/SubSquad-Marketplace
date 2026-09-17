"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Banknote, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatNaira } from "@/lib/money";
import { requestWithdrawal } from "./withdraw-actions";

/**
 * Withdrawing.
 *
 * Confirmed rather than instant: the whole balance goes at once, and a creator
 * who taps by accident should see where the money is going before it moves.
 * The bank is named in the confirmation for the same reason.
 */
export function WithdrawButton({
  availableKobo,
  canWithdraw,
  reason,
  bankLabel,
}: {
  availableKobo: number;
  canWithdraw: boolean;
  reason: string | null;
  bankLabel: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  async function go() {
    setBusy(true);
    const outcome = await requestWithdrawal();
    setBusy(false);
    setResult(outcome);
    if (outcome.ok) {
      setOpen(false);
      router.refresh();
    }
  }

  const needsBank = reason?.includes("bank account");

  return (
    <>
      <Button
        variant="brand"
        block
        className="mt-4"
        disabled={!canWithdraw}
        onClick={() => {
          setResult(null);
          setOpen(true);
        }}
      >
        <Banknote />
        {canWithdraw
          ? `Withdraw ${formatNaira(availableKobo)}`
          : "Withdraw to your bank"}
      </Button>

      {reason && (
        <p className="mt-2 text-center text-[12.5px] leading-relaxed text-ink-2">
          {reason}{" "}
          {needsBank && (
            <Link
              href="/creator/profile"
              className="font-medium text-brand-ink underline underline-offset-2"
            >
              Add it now
            </Link>
          )}
        </p>
      )}

      {result && (
        <p
          role="status"
          className={`mt-2 text-center text-[12.5px] leading-relaxed ${
            result.ok ? "text-ok" : "text-danger"
          }`}
        >
          {result.message}
        </p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <div className="space-y-2">
            <DialogTitle>Withdraw {formatNaira(availableKobo)}?</DialogTitle>
            <DialogDescription>
              This sends your whole available balance to your{" "}
              {bankLabel ?? "verified bank account"}. It usually lands within 24
              hours. Money still held in escrow for live deals is not affected.
            </DialogDescription>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Not now</Button>
            </DialogClose>
            <Button variant="brand" disabled={busy} onClick={go} autoFocus>
              {busy ? <Loader2 className="animate-spin" /> : <Banknote />}
              Withdraw {formatNaira(availableKobo)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
