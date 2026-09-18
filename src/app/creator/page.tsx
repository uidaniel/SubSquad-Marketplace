import Link from "next/link";
import { ChevronRight, Lock } from "lucide-react";
import { DealStatusBadge } from "@/components/app/status";
import { Badge } from "@/components/ui/badge";
import {
  getCreatorDeals,
  getCreatorMoney,
  getCurrentCreator,
} from "@/lib/data/creator-queries";
import { NOW } from "@/lib/data/queries";
import { formatNaira } from "@/lib/money";
import { cn, formatRelative } from "@/lib/utils";
import { NoCreatorSession } from "@/app/creator/no-session";

export const metadata = { title: "Your deals" };

/** Deals a creator still has to do something about, in the order they matter. */
const NEEDS_YOU: Record<string, string> = {
  invited: "Accept or decline",
  negotiating: "They replied to your counter",
  contract_signed: "Upload your draft",
  revision_requested: "One fix needed",
  approved: "Post it, then paste the link",
};

export default async function CreatorDealsPage() {
  const creator = await getCurrentCreator();
  if (!creator) return <NoCreatorSession what="your deals" />;
  const [deals, money] = await Promise.all([
    getCreatorDeals(creator.id),
    getCreatorMoney(creator.id),
  ]);

  const open = deals.filter(
    (d) => !["paid", "declined", "cancelled"].includes(d.deal.status),
  );
  const done = deals.filter((d) => d.deal.status === "paid");

  return (
    <>
      <h1 className="text-[22px] font-semibold tracking-[-0.02em]">
        Hi {creator.displayName.split(" ")[0]}
      </h1>

      {/* Money first: it is the reason they opened the app. */}
      <Link
        href="/creator/wallet"
        className="mt-4 block rounded-[var(--radius-lg)] border border-line bg-surface p-5"
      >
        <p className="text-[12.5px] text-ink-2">Ready to pay out</p>
        <p className="mt-1 text-[32px] font-semibold leading-none tracking-[-0.03em] tabular-nums">
          {formatNaira(money.availableKobo)}
        </p>
        {money.pendingKobo > 0 && (
          <p className="mt-2.5 inline-flex items-center gap-1.5 text-[12.5px] text-ink-2">
            <Lock className="size-3.5 text-ok" />
            {formatNaira(money.pendingKobo)} held in escrow for work in progress
          </p>
        )}
      </Link>

      <h2 className="mt-7 text-[13px] font-medium uppercase tracking-[0.05em] text-ink-3">
        Your deals
      </h2>

      <ul className="mt-2.5 space-y-2.5">
        {open.length === 0 && (
          <li className="rounded-[var(--radius-lg)] border border-line bg-surface px-5 py-10 text-center text-[13px] text-ink-3">
            Nothing open right now. We will email you when a brand
            funds a deal for you.
          </li>
        )}

        {open.map(({ deal, brandName, campaignName, takeHomeKobo }) => {
          const action = NEEDS_YOU[deal.status];
          return (
            <li key={deal.id}>
              <Link
                href={`/creator/deals/${deal.id}`}
                className={cn(
                  "flex items-center gap-3 rounded-[var(--radius-lg)] border bg-surface px-4 py-4 transition-colors active:bg-ground",
                  action ? "border-brand/40" : "border-line",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium">{brandName}</span>
                  <span className="block text-[12.5px] text-ink-3">
                    {campaignName ?? "Your own deal"} ·{" "}
                    {formatRelative(deal.deadline, NOW)}
                  </span>
                  <span className="mt-2 flex flex-wrap items-center gap-1.5">
                    <DealStatusBadge status={deal.status} />
                    {action && (
                      <Badge tone="brand" dot>
                        {action}
                      </Badge>
                    )}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[16px] font-semibold tabular-nums">
                    {formatNaira(takeHomeKobo)}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-ink-3" />
              </Link>
            </li>
          );
        })}
      </ul>

      {done.length > 0 && (
        <>
          <h2 className="mt-7 text-[13px] font-medium uppercase tracking-[0.05em] text-ink-3">
            Paid
          </h2>
          <ul className="mt-2.5 space-y-2.5">
            {done.map(({ deal, brandName, takeHomeKobo }) => (
              <li key={deal.id}>
                <Link
                  href={`/creator/deals/${deal.id}`}
                  className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-line bg-surface px-4 py-3.5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-medium">{brandName}</span>
                    <span className="block text-[12.5px] text-ink-3">
                      Paid {formatRelative(deal.publishedAt ?? deal.deadline, NOW)}
                    </span>
                  </span>
                  <span className="shrink-0 text-[15px] font-semibold tabular-nums text-ok">
                    {formatNaira(takeHomeKobo)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
