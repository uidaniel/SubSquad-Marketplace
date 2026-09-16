import * as React from "react";
import { cn } from "@/lib/utils";

/** Wrap a table in this so a narrow screen scrolls the table, not the page. */
export function TableWrap({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("w-full overflow-x-auto", className)} {...props} />;
}

export function Table({
  className,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={cn("w-full border-collapse text-[13.5px]", className)}
      {...props}
    />
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
