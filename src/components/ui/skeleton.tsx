import { cn } from "@/lib/utils";

/**
 * Loading states.
 *
 * These are built to the proportions of the content they stand in for — a
 * table skeleton has the same column widths and row height as the real table —
 * so the page does not jump when the data arrives. A spinner would be less
 * work and worse: it tells you something is happening but not what is coming,
 * and it throws the layout away and rebuilds it.
 *
 * Every skeleton is marked aria-hidden and sits inside a container that
 * announces the loading state once, rather than having a screen reader read out
 * forty empty boxes.
 */

export function Skeleton({
  className,
  dark,
}: {
  className?: string;
  dark?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "block rounded-[var(--radius-xs)] shimmer",
        dark && "shimmer-dark",
        className,
      )}
    />
  );
}

/** Wraps a set of skeletons and announces them once. */
export function LoadingRegion({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div role="status" aria-live="polite" aria-busy className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** A heading block: kicker, title, one line of subtitle. */
export function PageHeadSkeleton({ withActions = true }: { withActions?: boolean }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4 sm:mb-7">
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-3.5 w-72" />
      </div>
      {withActions && (
        <div className="flex gap-2.5">
          <Skeleton className="h-9 w-28 rounded-[var(--radius-sm)]" />
          <Skeleton className="h-9 w-36 rounded-[var(--radius-sm)]" />
        </div>
      )}
    </div>
  );
}

export function StatStripSkeleton({ items = 3 }: { items?: number }) {
  return (
    <div className="mb-7 grid grid-cols-1 gap-px overflow-hidden border-y border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="space-y-2 bg-ground px-0 py-3.5 sm:px-6 sm:first:pl-0">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

/**
 * A table placeholder.
 *
 * `columns` takes the widths of the real table so the skeleton lines up with
 * what replaces it — the first column wide for a name, the rest narrow.
 */
export function TableSkeleton({
  rows = 5,
  columns = ["40%", "20%", "20%", "20%"],
  header = true,
}: {
  rows?: number;
  columns?: string[];
  header?: boolean;
}) {
  return (
    <div>
      {header && (
        <div className="flex gap-4 border-b border-line bg-surface-2 px-5 py-2.5">
          {columns.map((width, i) => (
            <div key={i} style={{ width }}>
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      )}
      {Array.from({ length: rows }).map((_, row) => (
        <div
          key={row}
          className="flex items-center gap-4 border-b border-line px-5 py-3.5 last:border-b-0"
        >
          {columns.map((width, col) => (
            <div key={col} style={{ width }} className="space-y-1.5">
              <Skeleton className={cn("h-3.5", col === 0 ? "w-3/4" : "w-2/3")} />
              {col === 0 && <Skeleton className="h-3 w-1/2" />}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** A bordered panel with a titled header and a table inside it. */
export function PanelTableSkeleton({
  rows = 5,
  columns,
}: {
  rows?: number;
  columns?: string[];
}) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface shadow-[var(--shadow-panel)]">
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-16" />
      </div>
      <TableSkeleton rows={rows} columns={columns} header={false} />
    </div>
  );
}

/** A stack of cards, for the creator app and any card grid. */
export function CardListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-line bg-surface px-4 py-4"
        >
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <Skeleton className="h-5 w-20" />
        </div>
      ))}
    </div>
  );
}
