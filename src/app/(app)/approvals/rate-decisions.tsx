"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Loader2, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import {
  Panel,

  PanelFooter,
  PanelHeader,
  PanelTitle,
} from "@/components/ui/panel";
import { formatNaira, parseNairaInput } from "@/lib/money";
import { formatRelative } from "@/lib/utils";
import type { PendingRate } from "@/lib/deals/rates";
import { respondToRate } from "../rate-actions";

/**
 * Creators waiting on an answer about money.
 *
 * This is the queue that did not exist. A creator could name their rate and the
 * deal would sit in "negotiating" forever, because there was no screen showing
 * it and no action to settle it.
 *
 * Three answers and no fourth. The difference between the offer and the ask is
 * shown as a figure rather than left to be worked out, and a rate escrow cannot
 * cover is marked before the button is pressed rather than after.
 */
export function RateDecisions({ rates }: { rates: PendingRate[] }) {
  if (rates.length === 0) return null;

  return (
    <Panel accent>
      <PanelHeader
        action={
          <span className="text-[12.5px] text-ink-2">
            {rates.length} waiting
          </span>
        }
      >
        <PanelTitle>Creators waiting on a rate</PanelTitle>
      </PanelHeader>
      <ul className="divide-y divide-line">
        {rates.map((rate) => (
          <RateRow key={rate.dealId} rate={rate} />
        ))}
      </ul>
      <PanelFooter>
        A creator who waits for an answer takes other work. These are ordered
        oldest first.
      </PanelFooter>
    </Panel>
  );
}

function RateRow({ rate }: { rate: PendingRate }) {
  const router = useRouter();
  const [mode, setMode] = React.useState<"idle" | "counter" | "decline">("idle");
  const [amount, setAmount] = React.useState("");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const difference = rate.proposedKobo - rate.offeredKobo;
  const counterKobo = parseNairaInput(amount);

  async function run(
    kind: string,
    decision: Parameters<typeof respondToRate>[1],
  ) {
    setBusy(kind);
    setResult(null);
    const outcome = await respondToRate(rate.dealId, decision);
    setBusy(null);
    setResult(outcome);
    if (outcome.ok) router.refresh();
  }

  if (result?.ok) {
    return (
      <li className="px-5 py-4">
        <p role="status" className="text-[13px] font-medium text-ok">
          @{rate.creatorHandle} — {result.message}
        </p>
      </li>
    );
  }

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start gap-3">
        <Avatar name={rate.creatorName} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <Link
              href={`/creators/${rate.creatorId}`}
              className="font-medium hover:underline"
            >
              @{rate.creatorHandle}
            </Link>
            <span className="text-[12.5px] text-ink-3">
              {rate.campaignName} · asked {formatRelative(rate.proposedAt)}
            </span>
          </div>

          <p className="mt-1.5 text-[13.5px] text-ink-2">
            You offered{" "}
            <span className="font-medium tabular-nums text-ink">
              {formatNaira(rate.offeredKobo)}
            </span>
            . They are asking{" "}
            <span className="font-medium tabular-nums text-ink">
              {formatNaira(rate.proposedKobo)}
            </span>
            {difference !== 0 && (
              <span className={difference > 0 ? "text-warn" : "text-ok"}>
                {" "}
                ({difference > 0 ? "+" : "−"}
                {formatNaira(Math.abs(difference))})
              </span>
            )}
            .
          </p>

          {rate.note && (
            <p className="mt-1.5 border-l-2 border-line pl-3 text-[13px] italic leading-relaxed text-ink-2">
              {rate.note}
            </p>
          )}

          {!rate.affordable && (
            <p className="mt-2 flex gap-2 rounded-[var(--radius-sm)] bg-warn-soft px-3 py-2 text-[12.5px] leading-relaxed text-warn">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              Escrow is {formatNaira(rate.shortfallKobo)} short of covering this
              rate plus everything already promised on the campaign.
              {rate.campaignId && (
                <Link
                  href={`/campaigns/${rate.campaignId}/fund`}
                  className="font-medium underline"
                >
                  Add funds
                </Link>
              )}
            </p>
          )}

          {mode === "idle" && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={busy !== null || !rate.affordable}
                onClick={() => run("accept", { kind: "accept" })}
              >
                {busy === "accept" ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Check />
                )}
                Accept {formatNaira(rate.proposedKobo)}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null}
                onClick={() => {
                  setAmount("");
                  setMode("counter");
                }}
              >
                Offer a different rate
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy !== null}
                onClick={() => setMode("decline")}
              >
                <X /> Decline
              </Button>
            </div>
          )}

          {mode === "counter" && (
            <div className="mt-3 space-y-3 rounded-[var(--radius-sm)] border border-line bg-ground p-3.5">
              <Field label="Your offer" htmlFor={`counter-${rate.dealId}`}>
                <Input
                  id={`counter-${rate.dealId}`}
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={String(rate.offeredKobo / 100)}
                  autoFocus
                />
              </Field>
              <Field
                label="Why"
                hint="Sent to the creator as written."
                htmlFor={`counter-note-${rate.dealId}`}
              >
                <Textarea
                  id={`counter-note-${rate.dealId}`}
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="This is what the budget allows for one video on this campaign."
                />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={busy !== null || counterKobo === null}
                  onClick={() =>
                    counterKobo !== null &&
                    run("counter", {
                      kind: "counter",
                      amountKobo: counterKobo,
                      note,
                    })
                  }
                >
                  {busy === "counter" && <Loader2 className="animate-spin" />}
                  Send this offer
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setMode("idle")}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {mode === "decline" && (
            <div className="mt-3 space-y-3 rounded-[var(--radius-sm)] border border-line bg-ground p-3.5">
              <Field
                label="Why, briefly"
                hint="They read this. A reason they can act on is worth thirty seconds."
                htmlFor={`decline-${rate.dealId}`}
              >
                <Textarea
                  id={`decline-${rate.dealId}`}
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="We have filled this slot. We will come back to you on the next one."
                  autoFocus
                />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="danger"
                  disabled={busy !== null}
                  onClick={() => run("decline", { kind: "decline", note })}
                >
                  {busy === "decline" && <Loader2 className="animate-spin" />}
                  Decline this creator
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setMode("idle")}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {result && !result.ok && (
            <p role="alert" className="mt-2 text-[12.5px] text-danger">
              {result.message}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}
