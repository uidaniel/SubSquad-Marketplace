import { Check, MessageSquare } from "lucide-react";
import { Topbar } from "@/components/app/topbar";
import { Page, PageHead } from "@/components/app/page-head";
import { ActionButton } from "@/components/app/action-button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody, PanelFooter, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { getCurrentUser, getPendingMessageDrafts, NOW } from "@/lib/data/queries";
import { env } from "@/lib/env";
import { formatNaira } from "@/lib/money";
import { formatRelative } from "@/lib/utils";
import { approveMessage } from "../actions";

export const metadata = { title: "Outreach" };

/**
 * The outreach queue.
 *
 * This screen is the mechanism behind the product's loudest promise: nothing
 * reaches a creator until a person approves it. Every draft the AI wrote sits
 * here, in full, with the creator it is addressed to and the fee it quotes —
 * because approving a message you have not read is the same as not approving it.
 */
export default async function OutreachPage() {
  const [user, pending] = await Promise.all([
    getCurrentUser(),
    getPendingMessageDrafts(),
  ]);

  return (
    <>
      <Topbar crumbs={[{ label: "Outreach" }]} userName={user.name} unread={pending.length} />
      <Page>
        <PageHead
          title="Outreach"
          subtitle="Messages the AI has written and nobody has sent. Read each one before you approve it — it goes out in SubSquad's name, to a real person."
          actions={
            env.DRY_RUN ? (
              <Badge tone="warn" dot>
                DRY_RUN — nothing actually sends
              </Badge>
            ) : null
          }
        />

        {pending.length === 0 ? (
          <Panel>
            <PanelBody className="py-16 text-center">
              <MessageSquare className="mx-auto size-6 text-ink-3" />
              <p className="mt-3 text-[14px] font-medium">Nothing waiting</p>
              <p className="mx-auto mt-1 max-w-sm text-[13px] text-ink-2">
                Every drafted message has been approved or discarded. New drafts
                appear here as campaigns move into outreach.
              </p>
            </PanelBody>
          </Panel>
        ) : (
          <div className="space-y-4">
            {pending.map(({ message, deal }) => (
              <Panel key={message.id} accent>
                <PanelHeader
                  action={
                    <span className="text-[12.5px] text-ink-3">
                      drafted {formatRelative(message.createdAt, NOW)}
                    </span>
                  }
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar name={deal.creator.displayName} size="sm" />
                    <div className="min-w-0">
                      <PanelTitle>@{deal.creator.handle}</PanelTitle>
                      <p className="text-[12px] text-ink-3">
                        {deal.endBrandName} · {deal.campaignName} ·{" "}
                        {formatNaira(deal.deal.feeKobo)}
                      </p>
                    </div>
                  </div>
                </PanelHeader>

                <PanelBody>
                  <div className="flex flex-wrap items-center gap-2 pb-3">
                    <Badge tone="info">{message.channel}</Badge>
                    <Badge tone="warn" dot>
                      Not sent
                    </Badge>
                    <span className="text-[12px] text-ink-3">
                      to{" "}
                      {message.channel === "whatsapp"
                        ? (deal.creator.phone ?? "no number")
                        : (deal.creator.email ?? "no email")}
                    </span>
                  </div>

                  {/* The message, exactly as it will arrive. */}
                  <div className="rounded-[var(--radius-md)] border border-line bg-surface-2 p-4">
                    <p className="whitespace-pre-line text-[13.5px] leading-relaxed">
                      {message.body}
                    </p>
                  </div>

                  <div className="mt-4 flex flex-wrap items-start gap-2">
                    <ActionButton
                      action={approveMessage.bind(null, message.id)}
                      variant="default"
                    >
                      <Check /> Approve and send
                    </ActionButton>
                  </div>
                </PanelBody>
              </Panel>
            ))}
          </div>
        )}

        {pending.length > 0 && (
          <Panel className="mt-5">
            <PanelFooter className="text-ink-2">
              A creator gets at most one unsolicited message a week, and never
              another after they opt out. Both rules are enforced when you press
              approve, not when the draft was written — so an approval can still
              be refused, and it will tell you why.
            </PanelFooter>
          </Panel>
        )}
      </Page>
    </>
  );
}
