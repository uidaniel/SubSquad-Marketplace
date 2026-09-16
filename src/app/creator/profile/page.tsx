import { BadgeCheck, Building2, ExternalLink, ShieldCheck } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScoreBadge } from "@/components/app/status";
import { getCreatorMoney, getCurrentCreator } from "@/lib/data/creator-queries";
import { DEMO_PROFILES, DEMO_SCORES } from "@/lib/demo/data";
import { formatNaira } from "@/lib/money";
import { formatCount, formatPercent } from "@/lib/utils";

export const metadata = { title: "Your profile" };

export default async function CreatorProfilePage() {
  const creator = await getCurrentCreator();
  const [money] = await Promise.all([getCreatorMoney(creator.id)]);
  const profile = DEMO_PROFILES.find((p) => p.creatorId === creator.id);
  const score = DEMO_SCORES.find((s) => s.creatorId === creator.id);

  return (
    <>
      <div className="flex items-center gap-3.5">
        <Avatar name={creator.displayName} size="lg" />
        <div className="min-w-0">
          <h1 className="text-[20px] font-semibold tracking-[-0.02em]">
            @{creator.handle}
          </h1>
          <p className="text-[13px] text-ink-2">
            {creator.displayName} · {profile?.locationCity}
          </p>
        </div>
      </div>

      {/* The record a brand sees. It is the creator's main asset here. */}
      <section className="mt-5 rounded-[var(--radius-lg)] border border-line bg-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[14px] font-semibold">Your public record</h2>
          <Button variant="ghost" size="sm">
            View as a brand <ExternalLink />
          </Button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-[var(--radius-sm)] bg-line">
          <Stat label="Deals done" value={String(money.dealsCompleted)} />
          <Stat
            label="On time"
            value={
              money.onTimeTotal > 0 ? `${money.onTimeCount}/${money.onTimeTotal}` : "—"
            }
          />
          <Stat label="Disputes" value="0" />
        </div>
        <p className="mt-3 text-[12.5px] leading-relaxed text-ink-3">
          Earned {formatNaira(money.lifetimeKobo)} through SubSquad. Brands see this
          record, not your follower count, when they decide whether to book you.
        </p>
      </section>

      {/* The score, with the reasons — the same ones ops and the brand see. */}
      <section className="mt-4 rounded-[var(--radius-lg)] border border-line bg-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[14px] font-semibold">Your quality score</h2>
          {score && <ScoreBadge score={score.fraudScore} />}
        </div>
        {score && score.reasons.length === 0 ? (
          <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
            Nothing flagged. Your engagement, comments and growth all read as
            genuine.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {score?.reasons.map((reason) => (
              <li key={reason.id} className="text-[13px]">
                <span className="font-medium">{reason.label}</span>
                <span className="block text-[12.5px] text-ink-3">
                  {reason.evidence}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[12.5px] leading-relaxed text-ink-3">
          Think this is wrong? A person will review it — not the model that scored
          it.{" "}
          <button className="font-medium text-brand-ink hover:underline">
            Appeal your score
          </button>
        </p>
      </section>

      <section className="mt-4 rounded-[var(--radius-lg)] border border-line bg-surface">
        <div className="border-b border-line px-5 py-3.5">
          <h2 className="text-[14px] font-semibold">Your account</h2>
        </div>
        <dl className="divide-y divide-line">
          <Row
            label="Payout account"
            value={
              creator.payoutVerified ? "GTBank ••••6789" : "Not set up"
            }
            badge={
              creator.payoutVerified ? (
                <Badge tone="ok">
                  <BadgeCheck className="size-3" /> Verified
                </Badge>
              ) : (
                <Badge tone="warn">Needed to get paid</Badge>
              )
            }
          />
          <Row label="WhatsApp" value={creator.phone ?? "Not connected"} />
          <Row
            label={profile?.platform === "tiktok" ? "TikTok" : "Instagram"}
            value={`@${creator.handle} · ${formatCount(profile?.followers ?? 0)}`}
          />
          <Row
            label="Engagement"
            value={formatPercent(profile?.engagementRate ?? 0)}
          />
          <Row label="Languages" value={(profile?.languages ?? []).join(", ")} />
        </dl>
      </section>

      <section className="mt-4 flex items-start gap-3 rounded-[var(--radius-lg)] bg-surface-2 p-4">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ok" />
        <p className="text-[12.5px] leading-relaxed text-ink-2">
          SubSquad is free for creators, forever. We are paid by the brand, not by
          you — unless you choose to absorb the fee on a deal you brought in
          yourself.
        </p>
      </section>

      <div className="mt-4 flex items-start gap-3 rounded-[var(--radius-lg)] bg-surface-2 p-4">
        <Building2 className="mt-0.5 size-4 shrink-0 text-ink-3" />
        <p className="text-[12.5px] leading-relaxed text-ink-2">
          Brands you have worked with can rebook you directly. You can turn that off
          in settings at any time.
        </p>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface px-3 py-3.5 text-center">
      <p className="text-[18px] font-semibold tabular-nums tracking-[-0.02em]">
        {value}
      </p>
      <p className="mt-0.5 text-[11.5px] text-ink-2">{label}</p>
    </div>
  );
}

function Row({
  label,
  value,
  badge,
}: {
  label: string;
  value: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-5 py-3">
      <dt className="text-[13px] text-ink-2">{label}</dt>
      <dd className="flex items-center gap-2 text-right text-[13.5px] font-medium">
        {value}
        {badge}
      </dd>
    </div>
  );
}
