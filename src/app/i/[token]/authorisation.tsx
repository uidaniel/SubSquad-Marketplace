"use client";

import * as React from "react";
import { BadgeCheck, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatNaira } from "@/lib/money";
import { formatDate } from "@/lib/utils";

/**
 * Proof that this is a real campaign with real money behind it.
 *
 * The thing a Nigerian creator is actually weighing is not "is this brand
 * impressive" but "will I be paid, or is this another person who disappears
 * after I post". So the panel leads with the one claim that can be checked —
 * the money is already held, by us, not by the brand — and is careful to state
 * only what is true.
 *
 * Every line is either a verified fact or absent. An unverified agency does not
 * get a soft version of the badge; it gets no badge and a sentence saying so.
 * A trust marker that appears whether or not anything was checked is worse than
 * none, because the first creator who gets burned stops believing all of them.
 */
export function Authorisation({
  agencyName,
  agencyVerified,
  agencyCac,
  agencyVerifiedAt,
  brandName,
  campaignName,
  feeSecured,
  feeKobo,
}: {
  agencyName: string | null;
  agencyVerified: boolean;
  agencyCac: string | null;
  agencyVerifiedAt: string | null;
  brandName: string;
  campaignName: string;
  /** Whether this creator's own fee is covered. Never the campaign total. */
  feeSecured: boolean;
  feeKobo: number;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <section className="mt-4 overflow-hidden rounded-[var(--radius-lg)] border border-ok/25 bg-surface">
      <div className="border-b border-ok/20 bg-ok-soft px-4 py-3">
        <p className="flex items-center gap-2 text-[13.5px] font-semibold text-ok">
          <ShieldCheck className="size-4" />
          Campaign authorisation
        </p>
      </div>

      <div className="space-y-2.5 px-4 py-4">
        <Fact
          proven={feeSecured}
          label={
            feeSecured
              ? `${formatNaira(feeKobo)} is held in escrow by SubSquad against your slot`
              : "The budget for this slot is being funded now"
          }
        />
        <Fact proven label="SubSquad holds it, not the brand" />
        {agencyVerified ? (
          <Fact
            proven
            label={
              agencyCac
                ? `${agencyName} is a registered company — ${agencyCac}`
                : `${agencyName} has been verified by SubSquad`
            }
          />
        ) : (
          <Fact
            proven={false}
            label={`${agencyName ?? "This agency"} has not completed company verification yet`}
          />
        )}

        <Button
          variant="outline"
          size="sm"
          block
          className="mt-3"
          onClick={() => setOpen(true)}
        >
          See what this means
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <div className="space-y-2">
            <DialogTitle>Campaign authorisation</DialogTitle>
          </div>

          <div className="space-y-4 text-[13.5px] leading-relaxed text-ink-2">
            <p>
              {agencyName ?? "An agency"} is running{" "}
              <span className="font-medium text-ink">{campaignName}</span> on
              behalf of <span className="font-medium text-ink">{brandName}</span>.
              The budget for it is on the platform already.
            </p>

            <dl className="space-y-2 rounded-[var(--radius-sm)] bg-ground px-3.5 py-3">
              <Line label="Campaign" value={campaignName} />
              <Line label="Brand" value={brandName} />
              <Line label="Run by" value={agencyName ?? "—"} />
              {agencyCac && <Line label="Company registration" value={agencyCac} />}
              {agencyVerifiedAt && (
                <Line
                  label="Verified"
                  value={formatDate(agencyVerifiedAt)}
                />
              )}
              <Line label="Reserved for you" value={formatNaira(feeKobo)} />
              <Line
                label="Held in escrow"
                value={feeSecured ? "Yes, in full" : "Being funded"}
              />
            </dl>

            <p className="flex gap-2">
              <Lock className="mt-0.5 size-4 shrink-0 text-ok" />
              <span>
                Escrow means the money has left the brand&apos;s wallet and
                cannot be spent on anything else. It is not the brand&apos;s to
                take back once you have delivered. If they go silent after you
                publish, we release it to you anyway.
              </span>
            </p>

            {!agencyVerified && (
              <p className="rounded-[var(--radius-sm)] bg-warn-soft px-3 py-2.5 text-[13px] text-warn">
                We have not finished checking this agency&apos;s company
                registration. The money is still held by us, so you are still
                paid — but if anything about this feels wrong, reply to the email
                and a person will answer.
              </p>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Fact({ label, proven }: { label: string; proven: boolean }) {
  return (
    <p className="flex gap-2 text-[13px] leading-relaxed">
      <BadgeCheck
        className={`mt-0.5 size-4 shrink-0 ${proven ? "text-ok" : "text-ink-3"}`}
      />
      <span className={proven ? "text-ink-2" : "text-ink-3"}>{label}</span>
    </p>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
      <dt className="text-[12.5px] text-ink-3">{label}</dt>
      <dd className="text-[13px] font-medium text-ink">{value}</dd>
    </div>
  );
}
