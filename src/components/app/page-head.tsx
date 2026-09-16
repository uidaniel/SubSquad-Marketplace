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
        "mb-7 flex flex-wrap items-start justify-between gap-4",
        className,
      )}
    >
      <div className="min-w-0">
        {kicker && <p className="mb-1 text-[13px] text-ink-2">{kicker}</p>}
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em]">
          {title}
        </h1>
        {subtitle && (
          <div className="mt-1.5 text-[13.5px] text-ink-2">{subtitle}</div>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2.5">{actions}</div>}
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
    <main className={cn("mx-auto w-full max-w-[1280px] px-4 pb-20 pt-7 sm:px-8", className)}>
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
    <div className="mb-7 flex flex-wrap gap-y-5 border-y border-line py-4">
      {items.map((item, i) => (
        <div
          key={item.label}
          className={cn(
            "min-w-[150px] flex-1 px-7 first:pl-0",
            i > 0 && "border-l border-line",
          )}
        >
          <p className="text-[12.5px] text-ink-2">{item.label}</p>
          <p className="mt-0.5 text-[22px] font-semibold tabular-nums tracking-[-0.02em]">
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
