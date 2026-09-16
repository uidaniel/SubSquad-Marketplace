import { Building2, ExternalLink, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody } from "@/components/ui/panel";
import { getVerificationQueue } from "@/lib/data/ops-queries";
import { formatNaira } from "@/lib/money";
import { formatRelative } from "@/lib/utils";
import { VerifyForm } from "./verify-form";

export const metadata = { title: "Verification · Ops" };

/**
 * Accounts waiting to be checked against the CAC register.
 *
 * Ordered oldest first — a queue where the newest jumps ahead is how somebody
 * waits a week. Accounts with money already in the wallet are marked, because
 * those are people who have paid and cannot yet spend it.
 */
export default async function VerificationPage() {
  const queue = await getVerificationQueue();

  if (queue.length === 0) {
    return (
      <Panel>
        <PanelBody className="py-14 text-center">
          <p className="text-[15px] font-medium">Nothing waiting</p>
          <p className="mt-1 text-[13.5px] text-ink-2">
            Every account has been looked at.
          </p>
        </PanelBody>
      </Panel>
    );
  }

  return (
    <div className="space-y-3">
      {queue.map((item) => (
        <Panel key={item.orgId}>
          <PanelBody className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[15px] font-semibold">{item.name}</h2>
                <Badge tone={item.type === "agency" ? "info" : "neutral"}>
                  {item.type === "agency" ? "Agency" : "Brand"}
                </Badge>
                {item.walletKobo > 0 && (
                  <Badge tone="warn" dot>
                    {formatNaira(item.walletKobo)} waiting
                  </Badge>
                )}
              </div>

              <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-[13px]">
                <div className="flex items-center gap-1.5">
                  <Building2 className="size-3.5 text-ink-3" />
                  <dt className="sr-only">CAC number</dt>
                  <dd className={item.cacNumber ? "" : "text-warn"}>
                    {item.cacNumber ?? "No CAC number given"}
                  </dd>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="size-3.5 text-ink-3" />
                  <dt className="sr-only">Team</dt>
                  <dd className="text-ink-2">
                    {item.memberCount}{" "}
                    {item.memberCount === 1 ? "person" : "people"}
                  </dd>
                </div>
                <div>
                  <dt className="sr-only">Waiting since</dt>
                  <dd className="text-ink-2">
                    Signed up {formatRelative(item.createdAt)}
                  </dd>
                </div>
              </dl>

              {item.cacNumber && (
                <a
                  href={`https://search.cac.gov.ng/home?q=${encodeURIComponent(item.cacNumber.replace(/^RC\s*/i, ""))}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-ink hover:underline"
                >
                  Look up on the CAC register
                  <ExternalLink className="size-3.5" />
                </a>
              )}
            </div>

            <VerifyForm orgId={item.orgId} name={item.name} />
          </PanelBody>
        </Panel>
      ))}
    </div>
  );
}
