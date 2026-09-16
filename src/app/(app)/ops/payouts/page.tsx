import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody } from "@/components/ui/panel";
import { getFailedPayouts } from "@/lib/data/ops-queries";
import { formatNaira } from "@/lib/money";
import { formatRelative } from "@/lib/utils";
import { RetryButton } from "./retry-button";

export const metadata = { title: "Failed payouts · Ops" };

/**
 * Transfers that did not arrive.
 *
 * Each row is a creator who did the work and has not been paid, so the wording
 * is about them rather than about the transfer. The money is already back in
 * their wallet — the reversal posts automatically when Paystack reports the
 * failure — so nothing is lost; it just has not landed.
 */
export default async function FailedPayoutsPage() {
  const payouts = await getFailedPayouts();

  if (payouts.length === 0) {
    return (
      <Panel>
        <PanelBody className="py-14 text-center">
          <p className="text-[15px] font-medium">No failed payouts</p>
          <p className="mt-1 text-[13.5px] text-ink-2">
            Everything that was sent, arrived.
          </p>
        </PanelBody>
      </Panel>
    );
  }

  return (
    <div className="space-y-3">
      {payouts.map((p) => (
        <Panel key={p.id}>
          <PanelBody className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[15px] font-semibold">{p.creatorName}</h2>
                <span className="text-[15px] font-semibold tabular-nums">
                  {formatNaira(p.amountKobo)}
                </span>
                {p.payoutVerified ? (
                  <Badge tone="ok" dot>
                    Account since verified
                  </Badge>
                ) : (
                  <Badge tone="warn" dot>
                    Account still unverified
                  </Badge>
                )}
              </div>

              <p className="mt-2 text-[13.5px] text-ink-2">
                {p.reason ?? "The bank gave no reason."}
              </p>
              <p className="mt-1 text-[12.5px] text-ink-3">
                Failed {formatRelative(p.createdAt)}
                {p.bankAccount && ` · account ending ${p.bankAccount.slice(-4)}`}
                {p.transferCode && ` · ${p.transferCode}`}
              </p>

              <p className="mt-2 text-[12.5px] text-ink-3">
                The money is back in their SubSquad wallet — it did not vanish.
              </p>
            </div>

            <RetryButton payoutId={p.id} canRetry={p.payoutVerified} />
          </PanelBody>
        </Panel>
      ))}
    </div>
  );
}
