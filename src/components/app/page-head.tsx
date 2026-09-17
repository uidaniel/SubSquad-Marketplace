import { cn } from "@/lib/utils";

/**
 * Every screen opens the same way: what this is, one line of context, and the
 * actions that belong to the whole page. Nothing else competes at this level.
 */
export function PageHead({
  title,
  kicker,
  subtitle,
  actions,
  className,
}: {
  title: string;
  kicker?: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-wrap items-start justify-between gap-4 sm:mb-7",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        {kicker && <p className="mb-1 text-[13px] text-ink-2">{kicker}</p>}
        {/* `text-balance` because a title that has to wrap should wrap evenly.
            A greeting carrying somebody's full name ran to three ragged lines on
            a 360px screen; balanced, the same words read as two. */}
        <h1 className="text-balance text-[19px] font-semibold leading-tight tracking-[-0.02em] sm:text-[22px]">
          {title}
        </h1>
        {subtitle && (
          <div className="mt-1.5 text-[13.5px] text-ink-2">{subtitle}</div>
        )}
      </div>
      {actions && (
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">{actions}</div>
      )}
    </div>
  );
}

/** The page body: one max width, one gutter, used by every screen. */
export function Page({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main className={cn("mx-auto w-full max-w-[1280px] px-4 pb-20 pt-6 sm:px-6 sm:pt-7 lg:px-8", className)}>
      {children}
    </main>
  );
}

/**
 * Numbers as a line of text rather than a row of cards.
 *
 * Four bordered tiles imply four things to click; these are just facts, so they
 * are set as text with hairline separators and get out of the way.
 */
export function StatStrip({
  items,
}: {
  items: { label: string; value: string; note?: string; tone?: "ok" | "warn" | "danger" }[];
}) {
  return (
    <div className="mb-7 grid grid-cols-1 gap-px overflow-hidden border-y border-line bg-line sm:[grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
      {items.map((item) => (
        <div key={item.label} className="bg-ground px-0 py-3.5 sm:px-6 sm:first:pl-0">
          <p className="text-[12.5px] text-ink-2">{item.label}</p>
          <p className="mt-0.5 text-[20px] font-semibold tabular-nums tracking-[-0.02em] sm:text-[22px]">
            {item.value}
          </p>
          {item.note && (
            <p
              className={cn(
                "mt-0.5 text-[12px]",
                item.tone === "ok" && "text-ok",
                item.tone === "warn" && "text-warn",
                item.tone === "danger" && "text-danger",
                !item.tone && "text-ink-3",
              )}
            >
              {item.note}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
