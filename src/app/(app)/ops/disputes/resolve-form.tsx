"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNaira } from "@/lib/money";
import { cn } from "@/lib/utils";
import { resolveDispute, type DisputeOutcome, type OpsResult } from "../actions";

/**
 * Deciding a dispute.
 *
 * Three outcomes, each spelled out as what will happen to the money rather than
 * named in the abstract — the person clicking this is deciding whether somebody
 * gets paid, and should be able to read the consequence off the button.
 *
 * The third exists because the honest answer is sometimes "we cannot tell from
 * here". The reserve absorbs it so the creator is paid today and the brand is
 * not charged for work they dispute; the platform carries the cost of its own
 * uncertainty, which is the right place for it to sit.
 */
const OUTCOMES: {
  value: DisputeOutcome;
  label: (args: { fee: string; creator: string; brand: string }) => string;
  detail: string;
}[] = [
  {
    value: "pay_creator",
    label: ({ fee, creator }) => `Pay ${creator} — ${fee} from escrow`,
    detail: "The work met the brief. The money leaves escrow and becomes theirs.",
  },
  {
    value: "refund_brand",
    label: ({ fee, brand }) => `Refund ${brand} — ${fee} back to their wallet`,
    detail:
      "The work was not delivered or did not meet the brief. The deal is cancelled.",
  },
  {
    value: "split_from_reserve",
    label: ({ fee, creator }) => `Pay ${creator} from the reserve — ${fee}`,
    detail:
      "Too close to call. The creator is paid today and the brand is not charged; the dispute reserve covers it.",
  },
];

export function ResolveForm({
  disputeId,
  feeKobo,
  creatorName,
  brandName,
}: {
  disputeId: string;
  feeKobo: number;
  creatorName: string;
  brandName: string;
}) {
  const [outcome, setOutcome] = React.useState<DisputeOutcome | null>(null);
  const [resolution, setResolution] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<OpsResult | null>(null);

  const labels = {
    fee: formatNaira(feeKobo),
    creator: creatorName,
    brand: brandName,
  };

  if (result && "ok" in result) {
    return (
      <p className="rounded-[var(--radius-sm)] bg-ok-soft px-3 py-2.5 text-[13.5px] font-medium text-ok">
        {result.message}
      </p>
    );
  }

  return (
    <div className="space-y-3 border-t border-line pt-4">
      <div className="space-y-2">
        {OUTCOMES.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => setOutcome(o.value)}
            aria-pressed={outcome === o.value}
            className={cn(
              "block w-full rounded-[var(--radius-md)] border p-3 text-left transition-colors",
              outcome === o.value
                ? "border-ink bg-surface"
                : "border-line hover:border-line-strong",
            )}
          >
            <span className="block text-[13.5px] font-medium">
              {o.label(labels)}
            </span>
            <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-2">
              {o.detail}
            </span>
          </button>
        ))}
      </div>

      {outcome && (
        <>
          <label
            className="block text-[12.5px] font-medium"
            htmlFor={`why-${disputeId}`}
          >
            Why. Both sides are told this.
          </label>
          <textarea
            id={`why-${disputeId}`}
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            rows={2}
            autoFocus
            placeholder="The brief asked for one video and one was delivered on time."
            className="w-full rounded-[var(--radius-sm)] border border-line-strong bg-surface p-2.5 text-[13px] outline-none focus-visible:border-ink"
          />

          <Button
            variant="brand"
            size="sm"
            disabled={busy || !resolution.trim()}
            onClick={async () => {
              setBusy(true);
              setResult(
                await resolveDispute({ disputeId, outcome, resolution }),
              );
              setBusy(false);
            }}
          >
            {busy && <Loader2 className="animate-spin" />}
            Resolve and move the money
          </Button>
        </>
      )}

      {result && "error" in result && (
        <p role="alert" className="text-[12.5px] text-danger">
          {result.error}
        </p>
      )}
    </div>
  );
}
