"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestRevision } from "../../actions";

/**
 * Asking for a change.
 *
 * The note goes to the creator word for word, on WhatsApp, so the field says so
 * — a reviewer who thinks they are writing an internal comment writes something
 * quite different from one who knows the creator will read it.
 *
 * Opens in place rather than on its own page: the reviewer needs the draft and
 * the checklist visible while they write, and a page navigation takes both away.
 */
export function RevisionForm({ draftId }: { draftId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [notes, setNotes] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        Request a revision
      </Button>
    );
  }

  return (
    <div className="w-full space-y-2.5 rounded-[var(--radius-md)] border border-line bg-ground p-3.5">
      <label
        className="block text-[12.5px] font-medium"
        htmlFor={`revision-${draftId}`}
      >
        What needs to change? The creator gets this word for word.
      </label>
      <textarea
        id={`revision-${draftId}`}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        autoFocus
        placeholder="The download link is missing from your bio — everything else is good to go."
        className="w-full rounded-[var(--radius-sm)] border border-line-strong bg-surface p-2.5 text-[13px] outline-none focus-visible:border-ink"
      />

      {error && (
        <p role="alert" className="text-[12.5px] text-danger">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={busy || !notes.trim()}
          onClick={async () => {
            setBusy(true);
            setError(null);
            const result = await requestRevision(draftId, notes);
            setBusy(false);
            if (result.ok) {
              setOpen(false);
              setNotes("");
              router.refresh();
            } else {
              setError(result.message);
            }
          }}
        >
          {busy && <Loader2 className="animate-spin" />}
          Send it back
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
        >
          Cancel
        </Button>
      </div>

      <p className="text-[12px] text-ink-3">
        One revision is included. The fee stays in escrow meanwhile.
      </p>
    </div>
  );
}
