import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Plus } from "lucide-react";
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
const ACCOUNT_LABELS: Record<string, string> = {
  space_wallet: "Client wallet",
  campaign_escrow: "Campaign escrow",
  creator_wallet: "Creator wallet",
  platform_fees: "SubSquad fee",
  dispute_reserve: "Dispute reserve",
  paystack_clearing: "Bank",
  payout_clearing: "Payout in transit",
};

const TYPE_LABELS: Record<string, { label: string; tone: "ok" | "info" | "neutral" | "warn" }> = {
  deposit: { label: "Deposit", tone: "ok" },
  lock: { label: "Funded campaign", tone: "info" },
  release: { label: "Released to creator", tone: "info" },
  fee: { label: "Platform fee", tone: "neutral" },
  payout: { label: "Payout", tone: "info" },
  refund: { label: "Refund", tone: "warn" },
  reserve: { label: "Dispute settlement", tone: "warn" },
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
              <Table>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH className="w-[38%]">What happened</TH>
                    <TH className="hidden lg:table-cell">From</TH>
                    <TH className="hidden lg:table-cell">To</TH>
                    <TH numeric>Amount</TH>
                    <TH numeric className="hidden sm:table-cell">When</TH>
                  </TR>
                </THead>
                <TBody>
                  {transactions.length === 0 ? (
                    <TableEmpty colSpan={5}>
                      Nothing yet. Add funds to get started.
                    </TableEmpty>
                  ) : (
                    transactions.map(({ transaction, accounts }) => {
                      // A transaction's size is the total credited, which for a
                      // balanced pair is the same as the total debited.
                      const amount = transaction.entries
                        .filter((e) => e.amountKobo > 0)
                        .reduce((s, e) => s + e.amountKobo, 0);
                      const fromIdx = transaction.entries.findIndex(
                        (e) => e.amountKobo < 0,
                      );
                      const toIdx = transaction.entries.findIndex(
                        (e) => e.amountKobo > 0,
                      );
                      const meta = TYPE_LABELS[transaction.type] ?? {
                        label: transaction.type,
                        tone: "neutral" as const,
                      };
                      return (
                        <TR key={transaction.id}>
                          <TD>
                            <CellMain>{transaction.memo}</CellMain>
                            <CellSub>
                              {transaction.createdBy ?? "Automatic"}
                              {transaction.reference ? ` · ${transaction.reference}` : ""}
                            </CellSub>
                          </TD>
                          <TD className="hidden lg:table-cell">
                            <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-2">
                              <ArrowUpRight className="size-3.5 text-ink-3" />
                              {ACCOUNT_LABELS[accounts[fromIdx]?.kind ?? ""] ?? "—"}
                            </span>
                          </TD>
                          <TD className="hidden lg:table-cell">
                            <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-2">
                              <ArrowDownLeft className="size-3.5 text-ok" />
                              {ACCOUNT_LABELS[accounts[toIdx]?.kind ?? ""] ?? "—"}
                            </span>
                          </TD>
                          <TD numeric>
                            <CellMain className="tabular-nums">
                              {formatNaira(amount)}
                            </CellMain>
                            <Badge tone={meta.tone} className="mt-0.5">
                              {meta.label}
                            </Badge>
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
