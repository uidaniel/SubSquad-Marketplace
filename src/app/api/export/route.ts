import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import {
  getCampaignSummaries,
  getDealsForCampaign,
  getTransactions,
} from "@/lib/data/queries";
import { formatNaira } from "@/lib/money";

/**
 * CSV exports.
 *
 * An agency reconciles against their own books and reports to a client in a
 * spreadsheet, so a platform they cannot get numbers out of is a platform they
 * will not keep money in. Three "Export" buttons existed and none of them did
 * anything.
 *
 * Reads go through the normal query layer, which runs as the signed-in user, so
 * row-level security decides what lands in the file. There is no way to export
 * another org's rows by changing the query string.
 *
 *   /api/export?kind=ledger
 *   /api/export?kind=campaigns
 *   /api/export?kind=campaign&id=<campaign id>
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One CSV field.
 *
 * Quotes everything and doubles internal quotes. Also neutralises a leading
 * `=`, `+`, `-` or `@`: Excel treats those as formulas, so a creator whose
 * display name begins with one would otherwise become executable content in
 * somebody's spreadsheet.
 */
function cell(value: unknown): string {
  const raw = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.split('"').join('""')}"`;
}

const toCsv = (rows: unknown[][]) =>
  rows.map((row) => row.map(cell).join(",")).join("\r\n");

export async function GET(request: Request) {
  const session = await requireSession();
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind") ?? "ledger";
  const campaignId = searchParams.get("id");

  const stamp = new Date().toISOString().slice(0, 10);
  let filename = `subsquad-${kind}-${stamp}.csv`;
  let rows: unknown[][];

  if (kind === "campaign" && campaignId) {
    const deals = await getDealsForCampaign(campaignId);
    const summaries = await getCampaignSummaries();
    const summary = summaries.find((s) => s.campaign.id === campaignId);

    filename = `${(summary?.campaign.name ?? "campaign")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}-${stamp}.csv`;

    rows = [
      ["Creator", "Handle", "Platform", "Status", "Fee", "Published", "URL"],
      ...deals.map((d) => [
        d.creator.displayName,
        `@${d.creator.handle}`,
        d.profile?.platform ?? "",
        d.deal.status,
        formatNaira(d.deal.feeKobo),
        d.deal.publishedAt ?? "",
        d.deal.publishedUrl ?? "",
      ]),
    ];
  } else if (kind === "campaigns") {
    const summaries = await getCampaignSummaries();
    rows = [
      [
        "Campaign",
        "Client",
        "Brand",
        "Status",
        "Budget",
        "Held in escrow",
        "Paid to creators",
        "Creators confirmed",
        "Deadline",
      ],
      ...summaries.map((s) => [
        s.campaign.name,
        s.spaceName,
        s.campaign.endBrandName,
        s.campaign.status,
        formatNaira(s.campaign.budgetKobo),
        formatNaira(s.escrowHeldKobo),
        formatNaira(s.paidOutKobo),
        `${s.creatorsConfirmed} of ${s.creatorsTarget}`,
        s.campaign.deadline ?? "",
      ]),
    ];
  } else {
    // Every movement of money, which is what reconciliation actually needs.
    const transactions = await getTransactions(1000);
    rows = [
      ["Date", "Type", "Description", "Reference", "Amount"],
      ...transactions.map(({ transaction }) => {
        const amount = transaction.entries
          .filter((e) => e.amountKobo > 0)
          .reduce((sum, e) => sum + e.amountKobo, 0);
        return [
          transaction.createdAt,
          transaction.type,
          transaction.memo,
          transaction.reference ?? "",
          formatNaira(amount),
        ];
      }),
    ];
  }

  // The BOM makes Excel read it as UTF-8, without which the naira sign arrives
  // as mojibake on a Nigerian accountant's Windows machine.
  const body = `﻿${toCsv(rows)}`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      // Named so an export can be traced back to who ran it if it ever leaks.
      "X-Exported-By": session.org.id,
    },
  });
}
