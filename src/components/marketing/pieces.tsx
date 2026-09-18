import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The parts a public page is made of.
 *
 * A marketing site for an escrow product has one job: to be believed. So the
 * artwork here is the product's own paperwork — a receipt, a ledger, a stage
 * list — set large, in ink on cream, with the numbers doing the talking.
 * No photographs, no illustration, no gradient. One tangerine action.
 */

/** Page-width column, so every rule on every page lines up. */
export function Wrap({
  className,
  children,
  ...rest
}: {
  className?: string;
  children: React.ReactNode;
} & Record<`data-${string}`, string | boolean | undefined>) {
  return (
    <div className={cn("mx-auto w-full max-w-[1180px] px-5 sm:px-8", className)} {...rest}>
      {children}
    </div>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-brand-ink">
      {children}
    </p>
  );
}

const DISPLAY = {
  xl: "text-[clamp(38px,6.4vw,78px)] leading-[1.02] tracking-[-0.035em]",
  l: "text-[clamp(28px,3.6vw,44px)] leading-[1.08] tracking-[-0.025em]",
  m: "text-[clamp(22px,2.4vw,28px)] leading-[1.15] tracking-[-0.02em]",
} as const;

export function Display({
  as: Tag = "h2",
  size = "l",
  className,
  children,
  ...rest
}: {
  as?: "h1" | "h2" | "h3" | "p";
  size?: keyof typeof DISPLAY;
  className?: string;
  children: React.ReactNode;
} & Record<`data-${string}`, string | boolean | undefined>) {
  return (
    <Tag className={cn("font-display font-semibold", DISPLAY[size], className)} {...rest}>
      {children}
    </Tag>
  );
}

/* --------------------------------------------------------------------------
   Hero
   -------------------------------------------------------------------------- */

export function Hero({
  eyebrow,
  title,
  lede,
  primary,
  secondary,
  ticks,
  aside,
}: {
  eyebrow: string;
  title: React.ReactNode;
  lede: string;
  primary: { href: string; label: string };
  secondary?: { href: string; label: string };
  ticks?: readonly string[];
  aside?: React.ReactNode;
}) {
  return (
    <section className="py-14 sm:py-20 lg:py-24">
      <Wrap
        className={cn(
          "grid gap-12",
          aside && "lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-center",
        )}
      >
        <div>
          <p data-hero>
            <Eyebrow>{eyebrow}</Eyebrow>
          </p>
          <Display as="h1" size="xl" className="mt-4 max-w-[13ch]" data-hero>
            {title}
          </Display>
          <p data-hero className="mt-6 max-w-[44ch] text-[17px] leading-relaxed text-ink-2 sm:text-[18px]">
            {lede}
          </p>
          <div data-hero className="mt-8 flex flex-wrap gap-3">
            <Button variant="brand" size="lg" asChild>
              <Link href={primary.href}>
                {primary.label} <ArrowRight />
              </Link>
            </Button>
            {secondary && (
              <Button variant="outline" size="lg" asChild>
                <Link href={secondary.href}>{secondary.label}</Link>
              </Button>
            )}
          </div>
          {ticks && (
            <ul data-hero className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
              {ticks.map((tick) => (
                <li key={tick} className="flex items-center gap-2 text-[14px] text-ink-2">
                  <Check className="size-4 text-ok" aria-hidden />
                  {tick}
                </li>
              ))}
            </ul>
          )}
        </div>
        {aside && (
          <div data-hero className="min-w-0">
            {aside}
          </div>
        )}
      </Wrap>
    </section>
  );
}

/* --------------------------------------------------------------------------
   Receipt — the product's own paperwork, set as the artwork.
   -------------------------------------------------------------------------- */

export interface ReceiptLine {
  label: string;
  value: string;
  /** `done` gets a tick; `strong` is the total line. */
  tone?: "done" | "strong" | "muted";
}

export function Receipt({
  title,
  status,
  amount,
  caption,
  lines,
  totals,
  number,
  className,
}: {
  title: string;
  status?: string;
  /** The big number. Tabular, display face. */
  amount: string;
  caption: string;
  lines: readonly ReceiptLine[];
  totals?: readonly ReceiptLine[];
  number?: string;
  className?: string;
}) {
  return (
    <figure
      className={cn(
        "rounded-[var(--radius-lg)] border border-line bg-surface text-ink",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 px-5 pt-5 sm:px-6">
        <span className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">
          {title}
        </span>
        {status && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ok-soft px-2.5 py-1 text-[12.5px] font-semibold text-ok">
            <span className="size-1.5 rounded-full bg-ok" aria-hidden />
            {status}
          </span>
        )}
      </div>
      <div className="px-5 pb-5 pt-3 sm:px-6">
        <p className="font-display text-[clamp(38px,4.6vw,56px)] font-semibold leading-none tracking-[-0.035em] tabular-nums">
          {amount}
        </p>
        <p className="mt-2 text-[14px] text-ink-2">{caption}</p>
      </div>
      <dl className="border-t border-line px-5 sm:px-6">
        {lines.map((line) => (
          <div
            key={line.label}
            className="flex items-baseline justify-between gap-4 border-b border-line py-3 last:border-b-0"
          >
            <dt className="flex items-center gap-2 text-[14.5px]">
              {line.tone === "done" && <Check className="size-4 text-ok" aria-hidden />}
              {line.label}
            </dt>
            <dd className="text-[14.5px] font-medium tabular-nums text-ink-2">{line.value}</dd>
          </div>
        ))}
      </dl>
      {totals && (
        <>
          <div className="perf mx-0" aria-hidden />
          <dl className="px-5 py-4 sm:px-6">
            {totals.map((line) => (
              <div
                key={line.label}
                className={cn(
                  "flex items-baseline justify-between gap-4 py-1.5 text-[14px]",
                  line.tone === "strong" && "text-[16px] font-semibold",
                  line.tone === "muted" && "text-ink-3",
                )}
              >
                <dt>{line.label}</dt>
                <dd className="tabular-nums">{line.value}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
      {number && (
        <figcaption className="border-t border-line px-5 py-3 font-mono text-[11.5px] text-ink-3 sm:px-6">
          {number}
        </figcaption>
      )}
    </figure>
  );
}

/* --------------------------------------------------------------------------
   Register — the numbered sequence gutter, like an invoice's line numbers.
   -------------------------------------------------------------------------- */

export interface RegisterItem {
  n: string;
  title: string;
  body: string;
  proof: React.ReactNode;
}

export function Register({
  heading,
  items,
}: {
  heading?: React.ReactNode;
  items: readonly RegisterItem[];
}) {
  return (
    <section className="border-t border-line">
      {heading && (
        <Wrap className="pt-14 sm:pt-20">{heading}</Wrap>
      )}
      <Wrap>
        {items.map((item) => (
          <article
            key={item.n}
            data-reveal
            className="grid gap-6 border-t border-line py-12 first:border-t-0 sm:py-16 lg:grid-cols-[110px_minmax(0,1fr)_minmax(0,440px)] lg:gap-10"
          >
            <p className="font-display text-[22px] font-semibold tabular-nums text-brand-ink lg:sticky lg:top-24 lg:self-start">
              {item.n}
            </p>
            <div>
              <Display as="h3" size="l" className="max-w-[18ch]">
                {item.title}
              </Display>
              <p className="mt-4 max-w-[46ch] text-[16.5px] leading-relaxed text-ink-2">
                {item.body}
              </p>
            </div>
            <div className="min-w-0">{item.proof}</div>
          </article>
        ))}
      </Wrap>
    </section>
  );
}

/** The card a piece of proof sits in: paper, hairline, a small label. */
export function Proof({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] border border-line bg-surface",
        className,
      )}
    >
      <p className="border-b border-line px-5 py-3 text-[12.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">
        {label}
      </p>
      <div className="p-2">{children}</div>
    </div>
  );
}

/** One key/value line inside a proof card. */
export function Line({
  k,
  v,
  sub,
  tone,
}: {
  k: React.ReactNode;
  v?: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "ok" | "danger" | "strong" | "muted";
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-3 py-3 last:border-b-0">
      <div className="min-w-0">
        <p className={cn("text-[14.5px]", tone === "strong" && "font-semibold", tone === "muted" && "text-ink-3")}>
          {k}
        </p>
        {sub && <p className="mt-0.5 text-[13px] leading-relaxed text-ink-3">{sub}</p>}
      </div>
      {v !== undefined && (
        <p
          className={cn(
            "shrink-0 text-[14.5px] font-medium tabular-nums",
            tone === "ok" && "text-ok",
            tone === "danger" && "text-danger",
            tone === "strong" && "font-semibold",
            tone === "muted" && "text-ink-3",
          )}
        >
          {v}
        </p>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Figures — the numbers band, ink on the page's one dark section.
   -------------------------------------------------------------------------- */

export function Figures({
  items,
}: {
  items: readonly { figure: string; note: string }[];
}) {
  return (
    <section className="bg-chrome text-chrome-ink">
      <Wrap className="grid gap-10 py-14 sm:py-20 md:grid-cols-3 md:gap-8">
        {items.map((item) => (
          <div key={item.figure} className="border-l border-white/15 pl-5">
            <p className="font-display text-[clamp(44px,5.6vw,68px)] font-semibold leading-none tracking-[-0.035em] tabular-nums text-white">
              {item.figure}
            </p>
            <p className="mt-3 max-w-[26ch] text-[15px] leading-relaxed text-chrome-ink/75">
              {item.note}
            </p>
          </div>
        ))}
      </Wrap>
    </section>
  );
}

/* --------------------------------------------------------------------------
   Doors — two audiences, one line each.
   -------------------------------------------------------------------------- */

export function Doors({
  items,
}: {
  items: readonly { href: string; title: string; body: string; cta: string }[];
}) {
  return (
    <section className="border-t border-line">
      <Wrap data-reveal-group className="grid gap-px overflow-hidden py-14 sm:py-20 md:grid-cols-2 md:gap-8">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group rounded-[var(--radius-lg)] border border-line bg-surface p-6 transition-colors hover:border-line-strong sm:p-8"
          >
            <Display as="h3" size="m">
              {item.title}
            </Display>
            <p className="mt-3 max-w-[40ch] text-[15.5px] leading-relaxed text-ink-2">
              {item.body}
            </p>
            <span className="mt-6 inline-flex items-center gap-1.5 text-[14.5px] font-semibold text-brand-ink">
              {item.cta}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </Wrap>
    </section>
  );
}

/* --------------------------------------------------------------------------
   Closing — the last thing on every page is the one action.
   -------------------------------------------------------------------------- */

export function Closing({
  title,
  primary,
  note,
}: {
  title: React.ReactNode;
  primary: { href: string; label: string };
  note?: React.ReactNode;
}) {
  return (
    <section className="border-t border-line">
      <Wrap data-reveal className="flex flex-col items-start gap-6 py-16 sm:py-24 md:flex-row md:items-end md:justify-between">
        <Display as="h2" size="xl" className="max-w-[14ch]">
          {title}
        </Display>
        <div className="flex flex-col items-start gap-3">
          <Button variant="brand" size="lg" asChild>
            <Link href={primary.href}>
              {primary.label} <ArrowRight />
            </Link>
          </Button>
          {note && <p className="text-[14px] text-ink-2">{note}</p>}
        </div>
      </Wrap>
    </section>
  );
}
