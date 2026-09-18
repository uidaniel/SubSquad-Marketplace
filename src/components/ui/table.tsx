import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Column labels, so a row can become a card on a phone.
 *
 * Every data table was cut off at 390px: five columns do not fit, the wrapper
 * scrolls sideways, and the visible part showed a campaign name wrapped over
 * four lines beside a truncated number. Below `sm` a table now renders each
 * row as a stacked card, each cell labelled with its column header.
 *
 * The labels reach the cells through CSS, not React: the table writes one
 * scoped rule per column (`td:nth-child(n)::before { content: "…" }`). A
 * context would have been the obvious way, and it does not exist in the
 * Server Components runtime these tables render in; cloning children to
 * inject a prop breaks the moment a row wraps its cells in a Fragment. A
 * stylesheet cares about neither, and ships no JavaScript.
 */
function cssString(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Wrap a table in this so a narrow screen scrolls the table, not the page. */
export function TableWrap({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("w-full overflow-x-auto", className)} {...props} />;
}

export function Table({
  className,
  labels,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement> & {
  /** Column headers in order. Turns rows into cards below `sm`. */
  labels?: readonly string[];
}) {
  // useId is one of the few hooks a Server Component may call.
  const scope = React.useId().replace(/[^A-Za-z0-9_-]/g, "");
  const rules = labels
    ?.map(
      (label, i) =>
        `[data-cards="${scope}"]>tbody>tr>td:nth-child(${i + 1})::before{content:"${cssString(label)}"}`,
    )
    .join("");

  return (
    <>
      {rules && <style>{rules}</style>}
      <table
        data-cards={labels ? scope : undefined}
        className={cn(
          "w-full border-collapse text-[13.5px]",
          labels && "table-cards",
          className,
        )}
        {...props}
      />
    </>
  );
}

export function THead({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("bg-surface-2", className)} {...props} />;
}

export function TBody(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}

export function TR({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn("border-t border-line first:border-t-0 hover:bg-ground", className)}
      {...props}
    />
  );
}

export function TH({
  className,
  numeric,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        "px-5 py-2.5 text-left text-[12px] font-medium text-ink-2",
        numeric && "text-right",
        className,
      )}
      {...props}
    />
  );
}

export function TD({
  className,
  numeric,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <td
      className={cn(
        "px-5 py-3 align-middle",
        numeric && "text-right tabular-nums",
        className,
      )}
      {...props}
    />
  );
}

/** The primary line in a cell — the campaign name, the creator's handle. */
export function CellMain({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn("block font-medium text-ink", className)} {...props} />
  );
}

/** The supporting line under it — the client, the platform, the date. */
export function CellSub({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn("block text-[12.5px] text-ink-3", className)} {...props} />
  );
}

/** Shown in place of rows when there is genuinely nothing, not when loading. */
export function TableEmpty({
  children,
  colSpan,
}: {
  children: React.ReactNode;
  colSpan: number;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-5 py-10 text-center text-[13px] text-ink-3">
        {children}
      </td>
    </tr>
  );
}
