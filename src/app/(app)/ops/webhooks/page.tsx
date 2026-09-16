import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody } from "@/components/ui/panel";
import { getWebhookProblems } from "@/lib/data/ops-queries";
import { formatRelative } from "@/lib/utils";
import { DismissButton } from "./dismiss-button";

export const metadata = { title: "Webhooks · Ops" };

/**
 * Webhooks that verified but could not be applied.
 *
 * Every one of these is money that Paystack says moved and our ledger does not
 * know about, so this queue should normally be empty and is worth treating as
 * an alarm when it is not. The causes are structural — a payment naming a
 * campaign that no longer exists, a transfer with no payout row — which is why
 * they are not retried: retrying will not fix any of them.
 */
export default async function WebhookProblemsPage() {
  const problems = await getWebhookProblems();

  if (problems.length === 0) {
    return (
      <Panel>
        <PanelBody className="py-14 text-center">
          <p className="text-[15px] font-medium">Nothing stuck</p>
          <p className="mt-1 text-[13.5px] text-ink-2">
            Every webhook that arrived was applied.
          </p>
        </PanelBody>
      </Panel>
    );
  }

  return (
    <div className="space-y-3">
      <p className="rounded-[var(--radius-md)] border border-warn/30 bg-warn-soft px-4 py-3 text-[13px] text-warn">
        Each of these is something a provider says happened that our ledger did
        not record. Work out what it was for before dismissing it — dismissing
        does not apply it.
      </p>

      {problems.map((w) => (
        <Panel key={w.id}>
          <PanelBody className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="danger" dot>
                  {w.provider}
                </Badge>
                <span className="font-mono text-[13px]">{w.eventType}</span>
                <span className="text-[12.5px] text-ink-3">
                  {formatRelative(w.createdAt)}
                </span>
              </div>

              <p className="mt-2 text-[13.5px] text-ink-2">
                {w.error ?? "No reason recorded."}
              </p>

              {w.reference && (
                <p className="mt-1 break-all font-mono text-[12px] text-ink-3">
                  {w.reference}
                </p>
              )}
            </div>

            <DismissButton id={w.id} />
          </PanelBody>
        </Panel>
      ))}
    </div>
  );
}
