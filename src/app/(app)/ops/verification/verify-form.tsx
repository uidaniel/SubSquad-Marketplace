"use client";

import * as React from "react";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { verifyOrg, type OpsResult } from "../actions";

/**
 * Approve or reject, with a reason.
 *
 * Rejecting demands a note and approving does not. A rejection is told to the
 * account and they have to be able to fix whatever it was — "rejected" with no
 * reason generates a support conversation and a person who feels stonewalled.
 */
export function VerifyForm({ orgId, name }: { orgId: string; name: string }) {
  const [mode, setMode] = React.useState<"idle" | "rejecting">("idle");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<OpsResult | null>(null);

  async function run(decision: "verified" | "rejected") {
    setBusy(true);
    setResult(await verifyOrg(orgId, decision, note));
    setBusy(false);
  }

  if (result && "ok" in result) {
    return (
      <p className="shrink-0 text-[13.5px] font-medium text-ok lg:w-[280px]">
        {result.message}
      </p>
    );
  }

  return (
    <div className="shrink-0 space-y-2 lg:w-[280px]">
      {mode === "rejecting" ? (
        <>
          <label className="block text-[12.5px] font-medium" htmlFor={`note-${orgId}`}>
            Why? {name} will be told this.
          </label>
          <textarea
            id={`note-${orgId}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            autoFocus
            placeholder="The CAC number does not match this company name."
            className="w-full rounded-[var(--radius-sm)] border border-line-strong bg-surface p-2.5 text-[13px] outline-none focus-visible:border-ink"
          />
          <div className="flex gap-2">
            <Button
              variant="danger"
              size="sm"
              block
              disabled={busy || !note.trim()}
              onClick={() => run("rejected")}
            >
              {busy && <Loader2 className="animate-spin" />}
              Reject
            </Button>
            <Button
              variant="ghost"
              size="sm"
              block
              disabled={busy}
              onClick={() => setMode("idle")}
            >
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <div className="flex gap-2">
          <Button
            variant="default"
            size="sm"
            block
            disabled={busy}
            onClick={() => run("verified")}
          >
            {busy ? <Loader2 className="animate-spin" /> : <Check />}
            Verify
          </Button>
          <Button
            variant="outline"
            size="sm"
            block
            disabled={busy}
            onClick={() => setMode("rejecting")}
          >
            <X />
            Reject
          </Button>
        </div>
      )}

      {result && "error" in result && (
        <p role="alert" className="text-[12.5px] text-danger">
          {result.error}
        </p>
      )}
    </div>
  );
}
