import Link from "next/link";
import { Topbar } from "@/components/app/topbar";
import { Page, PageHead } from "@/components/app/page-head";
import { CampaignStatusBadge } from "@/components/app/status";
import { Avatar } from "@/components/ui/avatar";
import { Panel, PanelBody, PanelFooter, PanelHeader, PanelTitle } from "@/components/ui/panel";
import {
  getCampaignSummaries,
  getCurrentUser,
  getWalletBalances,
} from "@/lib/data/queries";
import { formatNaira } from "@/lib/money";
import { cn } from "@/lib/utils";
import { AddClient } from "./add-client";

export const metadata = { title: "Clients" };

/**
 * An agency's clients.
 *
 * Each client is a wall: their money never mixes with another client's, and
 * neither do their campaigns or their creators' contracts. This screen exists
 * mostly to make that separation visible — an account exec running six clients
 * needs to see at a glance whose budget is where.
 */
export default async function SpacesPage() {
  const [user, wallets, campaigns] = await Promise.all([
    getCurrentUser(),
    getWalletBalances(),
    getCampaignSummaries(),
  ]);

  return (
    <>
      <Topbar crumbs={[{ label: "Clients" }]} userName={user.name} />
      <Page>
        <PageHead
          title="Clients"
          subtitle={`${wallets.length} client spaces. Each one has its own wallet, its own campaigns, and its own view — clients never see each other, and never see your margin.`}
          actions={
            <AddClient />
          }
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {wallets.map(({ space, availableKobo }) => {
            const theirs = campaigns.filter((c) => c.campaign.spaceId === space.id);
            const escrow = theirs.reduce((s, c) => s + c.escrowHeldKobo, 0);
            const paid = theirs.reduce((s, c) => s + c.paidOutKobo, 0);
            const live = theirs.filter(
              (c) => !["completed", "cancelled"].includes(c.campaign.status),
            );

            return (
              <Panel key={space.id}>
                <PanelHeader>
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={space.name} />
                    <div className="min-w-0">
                      <PanelTitle className="truncate">{space.name}</PanelTitle>
                      <p className="text-[12px] text-ink-3">{space.category}</p>
                    </div>
                  </div>
                </PanelHeader>

                <PanelBody className="space-y-3">
                  <Row
                    label="In their wallet"
                    value={formatNaira(availableKobo)}
                    muted={availableKobo === 0}
                  />
                  <Row label="Held in escrow" value={formatNaira(escrow)} muted={escrow === 0} />
                  <Row
                    label="Paid to creators"
                    value={formatNaira(paid)}
                    tone={paid > 0 ? "ok" : undefined}
                    muted={paid === 0}
                  />
                </PanelBody>

                {live.length > 0 && (
                  <div className="border-t border-line px-5 py-3">
                    <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.05em] text-ink-3">
                      Running now
                    </p>
                    <ul className="space-y-2">
                      {live.slice(0, 3).map((c) => (
                        <li key={c.campaign.id}>
                          <Link
                            href={`/campaigns/${c.campaign.id}`}
                            className="flex items-center justify-between gap-3 text-[13px]"
                          >
                            <span className="truncate font-medium">
                              {c.campaign.name}
                            </span>
                            <CampaignStatusBadge status={c.campaign.status} />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <PanelFooter className="flex items-center justify-between gap-3">
                  <span>
                    {theirs.length} campaign{theirs.length === 1 ? "" : "s"}
                  </span>
                  <Link
                    href="/wallet/deposit"
                    className="font-medium text-brand-ink hover:underline"
                  >
                    Add funds
                  </Link>
                </PanelFooter>
              </Panel>
            );
          })}
        </div>
      </Page>
    </>
  );
}

function Row({
  label,
  value,
  tone,
  muted,
}: {
  label: string;
  value: string;
  tone?: "ok";
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-[13.5px]">
      <span className="text-ink-2">{label}</span>
      <span
        className={cn(
          "font-medium tabular-nums",
          tone === "ok" && "text-ok",
          muted && "text-ink-3",
        )}
      >
        {value}
      </span>
    </div>
  );
}
