"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { approveDraft, requestRevision } from "../../actions";

/**
 * Approving a draft, or sending it back.
 *
 * Both buttons existed on this screen and neither did anything — the server
 * actions were written and never connected. Approving here is what lets the
 * creator publish and be paid, so a button that silently does nothing is the
 * worst possible failure: the agency thinks they have replied and the creator
 * is left waiting.
 *
 * A revision needs words. The note is sent to the creator verbatim, so it is a
 * required field rather than an optional one — "request a revision" with no
 * explanation is how five rounds of notes start.
 */
export function DraftDecision({ draftId }: { draftId: string }) {
  const router = useRouter();
  const [mode, setMode] = React.useState<"idle" | "revising">("idle");
  const [notes, setNotes] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  async function run(work: () => Promise<{ ok: boolean; message: string }>) {
    setBusy(true);
    setResult(null);
    const outcome = await work();
    setResult(outcome);
    setBusy(false);
    if (outcome.ok) {
      setMode("idle");
      setNotes("");
      router.refresh();
    }
  }

  if (result?.ok) {
    return (
      <p role="status" className="mt-4 text-[13px] font-medium text-ok">
        {result.message}
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {mode === "idle" ? (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="default"
            disabled={busy}
            onClick={() => run(() => approveDraft(draftId))}
          >
            {busy ? <Loader2 className="animate-spin" /> : <Check />}
            Approve
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => setMode("revising")}
          >
            Request a revision
          </Button>
        </div>
      ) : (
        <div className="space-y-3 rounded-[var(--radius-sm)] border border-line bg-ground p-3.5">
          <Field
            label="What needs to change"
            hint="The creator receives this word for word. Be specific enough to act on."
            htmlFor={`revision-${draftId}`}
          >
            <Textarea
              id={`revision-${draftId}`}
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="The disclosure tag is missing from the caption, and the product name is said once — we need it twice."
              autoFocus
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="default"
              disabled={busy || !notes.trim()}
              onClick={() => run(() => requestRevision(draftId, notes))}
            >
              {busy ? <Loader2 className="animate-spin" /> : <Undo2 />}
              Send back for changes
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setMode("idle");
                setResult(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {result && !result.ok && (
        <p role="alert" className="text-[13px] text-danger">
          {result.message}
        </p>
      )}
    </div>
  );
}
