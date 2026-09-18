import Link from "next/link";
import { Plus } from "lucide-react";
import { Topbar } from "@/components/app/topbar";
import { Page, PageHead, StatStrip } from "@/components/app/page-head";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Panel,
  PanelFooter,
  PanelHeader,
  PanelTitle,
} from "@/components/ui/panel";
import {
  CellMain,
  CellSub,
  Table,
  TableEmpty,
  TableWrap,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui/table";
import {
  getCurrentUser,
  getOrgMoneySummary,
  getTransactions,
  getWalletBalances,
} from "@/lib/data/queries";
import { formatNaira } from "@/lib/money";
import { cn, formatDate } from "@/lib/utils";

export const metadata = { title: "Wallet" };

/** Plain-English names for what the ledger calls each account kind. */
/** Where the money went when the receiving account is not the org's to see. */
const HIDDEN_DESTINATION: Record<string, string | undefined> = {
  release: "Creator",
  fee: "SubSquad fee",
  payout: "Creator's bank",
};

const ACCOUNT_LABELS: Record<string, string> = {
  space_wallet: "Client wallet",
  campaign_escrow: "Campaign escrow",
  creator_wallet: "Creator wallet",
  platform_fees: "SubSquad fee",
  dispute_reserve: "Dispute reserve",
  paystack_clearing: "Bank",
  payout_clearing: "Payout in transit",
};

export default async function WalletPage() {
  const [user, money, wallets, transactions] = await Promise.all([
    getCurrentUser(),
    getOrgMoneySummary(),
    getWalletBalances(),
    getTransactions(40),
  ]);

  return (
    <>
      <Topbar crumbs={[{ label: "Wallet" }]} userName={user.name} />
      <Page>
        <PageHead
          title="Wallet"
          subtitle="One wallet per client. Money moves from a wallet into a campaign's escrow when you fund it, and only leaves escrow when content is published and verified."
          actions={
            <Button variant="brand" asChild>
              <Link href="/wallet/deposit">
                <Plus /> Add funds
              </Link>
            </Button>
          }
        />

        <StatStrip
          items={[
            {
              label: "Available across wallets",
              value: formatNaira(money.walletsKobo),
              note: "Not committed to anything yet",
            },
            {
              label: "Held in escrow",
              value: formatNaira(money.escrowKobo),
              note: "Committed to live campaigns",
            },
            {
              label: "Paid to creators",
              value: formatNaira(money.paidOutKobo),
              note: "Released on verified publish",
              tone: "ok",
            },
          ]}
        />

        <div className="grid gap-5 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:items-start">
          <Panel>
            <PanelHeader>
              <PanelTitle>By client</PanelTitle>
            </PanelHeader>
            <ul className="divide-y divide-line">
              {wallets.map(({ space, availableKobo }) => (
                <li
                  key={space.id}
                  className="flex items-baseline justify-between gap-4 px-5 py-3.5"
                >
                  <span className="min-w-0">
                    <CellMain>{space.name}</CellMain>
                    <CellSub>{space.category}</CellSub>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-[14px] font-medium tabular-nums",
                      availableKobo === 0 && "text-ink-3",
                    )}
                  >
                    {formatNaira(availableKobo)}
                  </span>
                </li>
              ))}
            </ul>
            <PanelFooter>
              A client&apos;s money is never pooled with another&apos;s.
            </PanelFooter>
          </Panel>

          {/* Straight off the ledger: every row is a balanced transaction. */}
          <Panel>
            <PanelHeader
              action={<Badge tone="neutral">{transactions.length} entries</Badge>}
            >
              <PanelTitle>Every movement of money</PanelTitle>
            </PanelHeader>
            <TableWrap>
              <Table labels={["What happened", "Amount", "When"]}>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH>What happened</TH>
                    <TH numeric>Amount</TH>
                    <TH numeric className="hidden sm:table-cell">When</TH>
                  </TR>
                </THead>
                <TBody>
                  {transactions.length === 0 ? (
                    <TableEmpty colSpan={3}>
                      Nothing yet. Add funds to get started.
                    </TableEmpty>
                  ) : (
                    transactions.map(({ transaction, accounts }) => {
                      // The org sees only its own side of some transactions.
                      //
                      // A release credits a creator's wallet and a platform fee
                      // credits ours; neither account belongs to the org, so
                      // RLS hides those entries and the visible credits sum to
                      // zero. Summing credits alone printed "+₦0" on the two
                      // rows that matter most. The size is whichever side is
                      // visible; the direction is the org's — out if it left
                      // their wallet, or if all they can see is money leaving.
                      const credited = transaction.entries
                        .filter((e) => e.amountKobo > 0)
                        .reduce((s, e) => s + e.amountKobo, 0);
                      const debited = transaction.entries
                        .filter((e) => e.amountKobo < 0)
                        .reduce((s, e) => s - e.amountKobo, 0);
                      const amount = Math.max(credited, debited);

                      const fromIdx = transaction.entries.findIndex(
                        (e) => e.amountKobo < 0,
                      );
                      const toIdx = transaction.entries.findIndex(
                        (e) => e.amountKobo > 0,
                      );
                      const from = ACCOUNT_LABELS[accounts[fromIdx]?.kind ?? ""];
                      const to =
                        ACCOUNT_LABELS[accounts[toIdx]?.kind ?? ""] ??
                        HIDDEN_DESTINATION[transaction.type];

                      const leftTheWallet =
                        accounts[fromIdx]?.kind === "space_wallet" || credited === 0;

                      return (
                        <TR key={transaction.id}>
                          <TD>
                            <CellMain>{transaction.memo}</CellMain>
                            <CellSub>
                              {from && to ? `${from} → ${to}` : (to ?? from ?? "")}
                            </CellSub>
                          </TD>
                          <TD numeric>
                            <CellMain
                              className={cn(
                                "tabular-nums",
                                leftTheWallet ? "text-ink-2" : "text-ok",
                              )}
                            >
                              {leftTheWallet ? "−" : "+"}
                              {formatNaira(amount)}
                            </CellMain>
                          </TD>
                          <TD numeric className="hidden sm:table-cell">
                            <CellSub>{formatDate(transaction.createdAt)}</CellSub>
                          </TD>
                        </TR>
                      );
                    })
                  )}
                </TBody>
              </Table>
            </TableWrap>
            <PanelFooter>
              Every row here is a double-entry transaction. Balances above are the
              sum of these movements, not a stored number — which is why they
              cannot drift.
            </PanelFooter>
          </Panel>
        </div>
      </Page>
    </>
  );
}
