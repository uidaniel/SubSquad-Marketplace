import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody } from "@/components/ui/panel";
import { getDisputes } from "@/lib/data/ops-queries";
import { formatNaira } from "@/lib/money";
import { formatRelative } from "@/lib/utils";
import { ResolveForm } from "./resolve-form";

export const metadata = { title: "Disputes · Ops" };

/**
 * Open disputes.
 *
 * Someone has done work and someone else does not want to pay for it, and the
 * money is sitting in escrow while they disagree. Oldest first, because the
 * cost of this queue is borne by whoever is waiting.
 */
export default async function DisputesPage() {
  const disputes = await getDisputes();

  if (disputes.length === 0) {
    return (
      <Panel>
        <PanelBody className="py-14 text-center">
          <p className="text-[15px] font-medium">No open disputes</p>
          <p className="mt-1 text-[13.5px] text-ink-2">
            Both sides are getting what they agreed to.
          </p>
        </PanelBody>
      </Panel>
    );
  }

  return (
    <div className="space-y-3">
      {disputes.map((d) => (
        <Panel key={d.id} accent>
          <PanelBody className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={d.openedBy === "creator" ? "warn" : "info"} dot>
                Raised by the {d.openedBy === "creator" ? "creator" : "brand"}
              </Badge>
              <span className="text-[13px] text-ink-2">
                {formatRelative(d.createdAt)}
              </span>
              <span className="ml-auto text-[15px] font-semibold tabular-nums">
                {formatNaira(d.feeKobo)}
              </span>
            </div>

            <div>
              <p className="text-[14px] font-medium">
                {d.creatorName} · {d.brandName}
              </p>
              <Link
                href={`/deals/${d.dealId}`}
                className="text-[12.5px] text-brand-ink hover:underline"
              >
                Open the deal and read the thread
              </Link>
            </div>

            {/* Their words, not a summary of them. Whoever decides this should
                read what was actually said. */}
            <blockquote className="border-l-2 border-line pl-3 text-[13.5px] leading-relaxed text-ink-2">
              {d.reason}
            </blockquote>

            <ResolveForm
              disputeId={d.id}
              feeKobo={d.feeKobo}
              creatorName={d.creatorName}
              brandName={d.brandName}
            />
          </PanelBody>
        </Panel>
      ))}
    </div>
  );
}
