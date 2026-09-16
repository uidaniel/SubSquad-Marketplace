import Link from "next/link";
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  MessageSquare,
  ShieldAlert,
} from "lucide-react";
import { Topbar } from "@/components/app/topbar";
import { Page, PageHead, StatStrip } from "@/components/app/page-head";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody, PanelFooter, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { requireServiceClient } from "@/lib/supabase/service";
import { env } from "@/lib/env";
import { getCurrentUser, getPendingMessageDrafts, NOW } from "@/lib/data/queries";
import { integrations } from "@/lib/env";
import { formatNaira } from "@/lib/money";
import { formatRelative } from "@/lib/utils";

export const metadata = { title: "Ops console" };

/**
 * The ops console.
 *
 * Everything here is an exception: a verification waiting on a human, a dispute,
 * a payout the bank refused, a creator nobody could reach. The product is built
 * so these are rare — which is exactly why they need somewhere to be seen, or
 * they are never seen at all.
 */
export default async function OpsPage() {
  const user = await getCurrentUser();

  const counts = env.demoMode
    ? { pendingOrgs: 0, disputes: 0, failedPayouts: 0, unreachable: 0 }
    : await opsCounts();

  const drafts = await getPendingMessageDrafts();

  return (
    <>
      <Topbar crumbs={[{ label: "Ops console" }]} userName={user.name} />
      <Page>
        <PageHead
          kicker="Internal"
          title="Ops console"
          subtitle="The exceptions the automation deliberately refuses to decide on its own."
        />

        <StatStrip
          items={[
            {
              label: "Awaiting verification",
              value: String(counts.pendingOrgs),
              note: "Companies that cannot fund yet",
              tone: counts.pendingOrgs > 0 ? "warn" : undefined,
            },
            {
              label: "Open disputes",
              value: String(counts.disputes),
              note: "Paid from the reserve, either way",
              tone: counts.disputes > 0 ? "danger" : undefined,
            },
            {
              label: "Failed payouts",
              value: String(counts.failedPayouts),
              note: "Money is safe; the transfer bounced",
              tone: counts.failedPayouts > 0 ? "danger" : undefined,
            },
          ]}
        />

        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          <Panel>
            <PanelHeader
              action={<Badge tone={drafts.length ? "warn" : "neutral"}>{drafts.length}</Badge>}
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="size-4 text-ink-3" />
                <PanelTitle>Messages waiting for approval</PanelTitle>
              </div>
            </PanelHeader>
            {drafts.length === 0 ? (
              <PanelBody className="py-8 text-center text-[13px] text-ink-3">
                Nothing queued.
              </PanelBody>
            ) : (
              <ul className="divide-y divide-line">
                {drafts.slice(0, 5).map(({ message, deal }) => (
                  <li key={message.id} className="flex items-start gap-3 px-5 py-3.5">
                    <Avatar name={deal.creator.displayName} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-medium">
                        @{deal.creator.handle}
                      </p>
                      <p className="truncate text-[12.5px] text-ink-3">
                        {message.body.split("\n")[0]}
                      </p>
                    </div>
                    <span className="shrink-0 text-[12px] text-ink-3">
                      {formatRelative(message.createdAt, NOW)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <PanelFooter>
              <Link href="/outreach" className="font-medium text-brand-ink hover:underline">
                Open the outreach queue
              </Link>
            </PanelFooter>
          </Panel>

          <Panel>
            <PanelHeader>
              <div className="flex items-center gap-2">
                <ShieldAlert className="size-4 text-ink-3" />
                <PanelTitle>Integration health</PanelTitle>
              </div>
            </PanelHeader>
            <ul className="divide-y divide-line">
              {(
                [
                  ["Supabase", integrations.supabase, "Database, auth and storage"],
                  ["Anthropic", integrations.anthropic, "Shortlists and content review"],
                  ["Paystack", integrations.paystack, "Collections and payouts"],
                  ["WhatsApp", integrations.whatsapp, "First-touch outreach"],
                  ["Resend", integrations.resend, "Email fallback"],
                  ["Deepgram", integrations.deepgram, "Video transcription"],
                ] as const
              ).map(([name, live, what]) => (
                <li key={name} className="flex items-center gap-3 px-5 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-medium">{name}</span>
                    <span className="block text-[12.5px] text-ink-3">{what}</span>
                  </span>
                  <Badge tone={live ? "ok" : "neutral"} dot>
                    {live ? "Connected" : "Not configured"}
                  </Badge>
                </li>
              ))}
            </ul>
            <PanelFooter>
              {env.DRY_RUN ? (
                <span className="flex items-center gap-2 text-warn">
                  <AlertTriangle className="size-3.5" />
                  DRY_RUN is on — nothing is sent and no card is charged, whatever
                  is connected above.
                </span>
              ) : (
                <span className="flex items-center gap-2 text-danger">
                  <AlertTriangle className="size-3.5" />
                  DRY_RUN is off. Approved messages reach real people and transfers
                  move real money.
                </span>
              )}
            </PanelFooter>
          </Panel>

          <Panel>
            <PanelHeader>
              <div className="flex items-center gap-2">
                <BadgeCheck className="size-4 text-ink-3" />
                <PanelTitle>Verification queue</PanelTitle>
              </div>
            </PanelHeader>
            <PanelBody className="py-8 text-center text-[13px] text-ink-3">
              {counts.pendingOrgs === 0
                ? "No companies waiting. A company cannot fund a campaign until its CAC number is checked."
                : `${counts.pendingOrgs} waiting on a CAC check.`}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader>
              <div className="flex items-center gap-2">
                <Banknote className="size-4 text-ink-3" />
                <PanelTitle>Failed payouts</PanelTitle>
              </div>
            </PanelHeader>
            <PanelBody className="py-8 text-center text-[13px] text-ink-3">
              {counts.failedPayouts === 0
                ? "None. A failed transfer reverses its own ledger movement, so the creator's balance is never left short."
                : `${counts.failedPayouts} to retry.`}
            </PanelBody>
          </Panel>
        </div>
      </Page>
    </>
  );
}

async function opsCounts() {
  const db = requireServiceClient();
  const [orgs, disputes, payouts, unreachable] = await Promise.all([
    db.from("orgs").select("id", { count: "exact", head: true }).eq("verification_status", "pending"),
    db.from("disputes").select("id", { count: "exact", head: true }).eq("status", "open"),
    db.from("payouts").select("id", { count: "exact", head: true }).eq("status", "failed"),
    db.from("creators").select("id", { count: "exact", head: true }).is("phone", null).is("email", null),
  ]);
  return {
    pendingOrgs: orgs.count ?? 0,
    disputes: disputes.count ?? 0,
    failedPayouts: payouts.count ?? 0,
    unreachable: unreachable.count ?? 0,
  };
}
