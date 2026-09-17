"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Ban, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatNaira } from "@/lib/money";
import { cancelCampaign, previewCancelCampaign } from "../../actions";

/**
 * Cancelling a campaign and getting the money back.
 *
 * Escrowed money is the client's the whole time — held, not taken — so funding
 * must not be a one-way door. It was: there was no way to stop a funded
 * campaign, and the budget simply stayed locked.
 *
 * The consequence is fetched and shown *before* the confirm button appears,
 * because the two answers are completely different: either "₦224,000 comes back
 * to the wallet" or "three creators have signed and this is now a conversation,
 * not a refund".
 */
export function CancelCampaign({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [preview, setPreview] = React.useState<Awaited<
    ReturnType<typeof previewCancelCampaign>
  > | null>(null);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function openDialog() {
    setOpen(true);
    setError(null);
    setPreview(null);
    setPreview(await previewCancelCampaign(campaignId));
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    const result = await cancelCampaign(campaignId, reason);
    setBusy(false);
    if (result.ok) {
      setOpen(false);
      router.refresh();
    } else {
      setError(result.message);
    }
  }

  return (
    <>
      <Button variant="danger" size="sm" onClick={openDialog}>
        <Ban /> Cancel campaign
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <div className="space-y-2">
            <DialogTitle>Cancel this campaign?</DialogTitle>
            <DialogDescription>
              {preview === null
                ? "Checking what this would do…"
                : preview.canCancel
                  ? preview.refundKobo > 0
                    ? `${formatNaira(preview.refundKobo)} returns to the client's wallet straight away.${
                        preview.invitedCount > 0
                          ? ` ${preview.invitedCount} invited creator${preview.invitedCount === 1 ? " is" : "s are"} told it is off, so nobody does work nobody will pay for.`
                          : ""
                      }`
                    : "There is nothing in escrow, so no money moves."
                  : preview.reason}
            </DialogDescription>
          </div>

          {preview?.canCancel && (
            <Field
              label="Why"
              hint="Kept on the record, and sent to the creators who were invited."
              htmlFor="cancel-reason"
            >
              <Textarea
                id="cancel-reason"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="The client pulled the budget for this quarter."
                autoFocus
              />
            </Field>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-[var(--radius-sm)] bg-danger-soft px-3 py-2.5 text-[13px] leading-relaxed text-danger"
            >
              {error}
            </p>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">
                {preview?.canCancel ? "Keep it running" : "Close"}
              </Button>
            </DialogClose>
            {preview?.canCancel && (
              <Button
                variant="danger"
                disabled={busy || !reason.trim()}
                onClick={confirm}
              >
                {busy ? <Loader2 className="animate-spin" /> : <Ban />}
                {preview.refundKobo > 0
                  ? `Cancel and return ${formatNaira(preview.refundKobo)}`
                  : "Cancel campaign"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
