import { Banknote, Clock, Lock, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getCreatorDeals,
  getCreatorMoney,
  getCurrentCreator,
} from "@/lib/data/creator-queries";
import { NOW } from "@/lib/data/queries";
import { formatNaira } from "@/lib/money";
import { formatRelative } from "@/lib/utils";

export const metadata = { title: "Your money" };

export default async function CreatorWalletPage() {
  const creator = await getCurrentCreator();
  const [money, deals] = await Promise.all([
    getCreatorMoney(creator.id),
    getCreatorDeals(creator.id),
  ]);

  const paid = deals.filter((d) => d.deal.status === "paid");
  const inEscrow = deals.filter((d) =>
    ["contract_signed", "draft_submitted", "revision_requested", "approved", "published"].includes(
      d.deal.status,
    ),
  );

  return (
    <>
      <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Your money</h1>

      <div className="mt-4 rounded-[var(--radius-lg)] border border-line bg-surface p-5">
        <p className="text-[12.5px] text-ink-2">Ready to pay out</p>
        <p className="mt-1 text-[36px] font-semibold leading-none tracking-[-0.03em] tabular-nums">
          {formatNaira(money.availableKobo)}
        </p>
        <Button variant="brand" block className="mt-4" disabled={money.availableKobo === 0}>
          <Banknote /> Withdraw to {creator.payoutBankCode ? "GTBank ••••6789" : "your bank"}
        </Button>
        <p className="mt-2.5 text-center text-[12px] text-ink-3">
          Payouts land within 24 hours on a Nigerian bank account.
        </p>
      </div>

      {money.pendingKobo > 0 && (
        <div className="mt-3 flex items-start gap-3 rounded-[var(--radius-lg)] border border-line bg-surface p-4">
          <Lock className="mt-0.5 size-4 shrink-0 text-ok" />
          <div>
            <p className="text-[14px] font-medium tabular-nums">
              {formatNaira(money.pendingKobo)} held for you
            </p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-2">
              Across {inEscrow.length} deal{inEscrow.length === 1 ? "" : "s"} in progress.
              The brand has already paid this in — it is released when your post goes
              live and is verified.
            </p>
          </div>
        </div>
      )}

      {/* The public record that lets a creator prove they are worth booking. */}
      <div className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-[var(--radius-lg)] border border-line bg-line">
        <Stat label="Deals done" value={String(money.dealsCompleted)} />
        <Stat
          label="Paid on time"
          value={
            money.onTimeTotal > 0 ? `${money.onTimeCount}/${money.onTimeTotal}` : "—"
          }
        />
        <Stat label="Earned here" value={formatNaira(money.lifetimeKobo)} small />
      </div>

      <div className="mt-3 flex items-start gap-3 rounded-[var(--radius-lg)] bg-surface-2 p-4">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ok" />
        <p className="text-[12.5px] leading-relaxed text-ink-2">
          This record is yours and it is public on your profile. Brands use it to
          decide whether to book you, which is why we never let a brand mark you late
          without evidence.
        </p>
      </div>

      <h2 className="mt-7 text-[13px] font-medium uppercase tracking-[0.05em] text-ink-3">
        Payouts
      </h2>
      <ul className="mt-2.5 space-y-2.5">
        {paid.length === 0 && (
          <li className="rounded-[var(--radius-lg)] border border-line bg-surface px-5 py-8 text-center text-[13px] text-ink-3">
            Nothing paid out yet.
          </li>
        )}
        {paid.map(({ deal, brandName, takeHomeKobo }) => (
          <li
            key={deal.id}
            className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-line bg-surface px-4 py-3.5"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[14.5px] font-medium">{brandName}</span>
              <span className="block text-[12.5px] text-ink-3">
                {formatRelative(deal.publishedAt ?? deal.deadline, NOW)}
              </span>
            </span>
            <Badge tone="ok" dot>
              Paid
            </Badge>
            <span className="shrink-0 text-[15px] font-semibold tabular-nums">
              {formatNaira(takeHomeKobo)}
            </span>
          </li>
        ))}
      </ul>

      {inEscrow.length > 0 && (
        <>
          <h2 className="mt-7 text-[13px] font-medium uppercase tracking-[0.05em] text-ink-3">
            Coming
          </h2>
          <ul className="mt-2.5 space-y-2.5">
            {inEscrow.map(({ deal, brandName, takeHomeKobo }) => (
              <li
                key={deal.id}
                className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-line bg-surface px-4 py-3.5"
              >
                <Clock className="size-4 shrink-0 text-ink-3" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-medium">{brandName}</span>
                  <span className="block text-[12.5px] text-ink-3">
                    Due {formatRelative(deal.deadline, NOW)}
                  </span>
                </span>
                <span className="shrink-0 text-[15px] font-semibold tabular-nums text-ink-2">
                  {formatNaira(takeHomeKobo)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function Stat({
  label,
  value,
  small,
}: {
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div className="bg-surface px-3 py-4 text-center">
      <p
        className={
          small
            ? "text-[15px] font-semibold tabular-nums tracking-[-0.02em]"
            : "text-[19px] font-semibold tabular-nums tracking-[-0.02em]"
        }
      >
        {value}
      </p>
      <p className="mt-0.5 text-[11.5px] text-ink-2">{label}</p>
    </div>
  );
}
