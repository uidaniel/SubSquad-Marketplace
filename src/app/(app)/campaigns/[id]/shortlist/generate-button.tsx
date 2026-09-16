"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { runShortlist } from "../../../actions";

/**
 * Running the shortlist.
 *
 * The model reads sixty profiles, so this takes seconds rather than
 * milliseconds — long enough that a silent button reads as broken. The label
 * changes while it runs and says what is happening, because "Reading 60
 * profiles" is a reason to wait and a spinner is not.
 *
 * The reassurance underneath is not decoration. The single biggest fear an
 * agency has about handing outreach to an AI is that it will message somebody
 * without asking, and this button is where that fear is strongest.
 */
export function GenerateShortlistButton({
  campaignId,
  regenerate,
}: {
  campaignId: string;
  regenerate?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  return (
    <div className="space-y-2">
      <Button
        variant={regenerate ? "outline" : "brand"}
        size={regenerate ? "sm" : "lg"}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          setMessage(null);
          const result = await runShortlist(campaignId);
          setBusy(false);
          if (result.ok) {
            setMessage(result.message);
            router.refresh();
          } else {
            setError(result.message);
          }
        }}
      >
        {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
        {busy
          ? "Reading 60 profiles…"
          : regenerate
            ? "Suggest more"
            : "Generate shortlist"}
      </Button>

      {message && (
        <p className="text-[12.5px] text-ok">{message}</p>
      )}
      {error && (
        <p role="alert" className="text-[12.5px] text-danger">
          {error}
        </p>
      )}
      {!busy && !message && !error && !regenerate && (
        <p className="text-[12px] text-ink-3">
          Suggestions only. Nobody is contacted until you approve them.
        </p>
      )}
    </div>
  );
}
