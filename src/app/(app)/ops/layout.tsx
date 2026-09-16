import Link from "next/link";
import { requireStaff } from "@/lib/auth/staff";
import { getOpsCounts, getIntegrationHealth } from "@/lib/data/ops-queries";
import { Badge } from "@/components/ui/badge";
import { OpsTabs } from "./ops-tabs";

/**
 * The ops console.
 *
 * Gated here, once, for everything beneath it. `requireStaff` 404s rather than
 * 403s — somebody who is not staff has no business learning this exists.
 *
 * The banner across the top is the most important thing on the page: whether
 * this deployment can move real money. Ops work happens in staging and in
 * production and the screens are identical, so the difference has to be stated
 * rather than remembered.
 */
export default async function OpsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireStaff();
  const [counts, health] = await Promise.all([
    getOpsCounts(),
    Promise.resolve(getIntegrationHealth()),
  ]);

  const live = health.paystackLive && !health.dryRun;

  return (
    <div className="mx-auto w-full max-w-[1180px] px-6 py-6">
      <div
        className={
          live
            ? "mb-5 flex items-center gap-2.5 rounded-[var(--radius-md)] border border-danger/30 bg-danger-soft px-4 py-2.5"
            : "mb-5 flex items-center gap-2.5 rounded-[var(--radius-md)] border border-line bg-surface px-4 py-2.5"
        }
      >
        <Badge tone={live ? "danger" : "neutral"} dot>
          {live ? "Live" : health.dryRun ? "Dry run" : "Test keys"}
        </Badge>
        <p className="text-[13px] text-ink-2">
          {live
            ? "This deployment moves real money and messages real creators."
            : health.dryRun
              ? "Nothing here sends a message or moves money. DRY_RUN is on."
              : "Paystack is on test keys — charges and transfers are simulated."}
        </p>
      </div>

      <header className="mb-5">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">
          Ops console
        </h1>
        <p className="mt-1 text-[13.5px] text-ink-2">
          {counts.total === 0
            ? "Nothing is waiting. "
            : `${counts.total} ${counts.total === 1 ? "thing needs" : "things need"} a person. `}
          <Link
            href="/"
            className="font-medium text-brand-ink hover:underline"
          >
            Back to the app
          </Link>
        </p>
      </header>

      <OpsTabs counts={counts} />

      <div className="mt-5">{children}</div>
    </div>
  );
}
