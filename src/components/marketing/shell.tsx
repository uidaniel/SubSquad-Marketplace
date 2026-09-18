import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The frame around every public page: the mark, three links, two doors.
 *
 * No menu button and no JavaScript. On a phone the three links drop into a
 * second row under the bar instead of behind a hamburger, because a person
 * deciding whether to trust a platform with money should not have to open
 * anything to find out what it costs.
 */

/** The brand mark: "SS" in a tangerine square, cream letters. */
export function Mark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-[9px] bg-brand font-display text-[13px] font-bold text-[#fff3e6]",
        className,
      )}
    >
      SS
    </span>
  );
}

export function Wordmark() {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5" aria-label="SubSquad home">
      <Mark />
      <span className="font-display text-[17px] font-semibold tracking-[-0.02em]">
        SubSquad
      </span>
    </Link>
  );
}

const NAV = [
  { href: "/for-agencies", label: "Agencies" },
  { href: "/for-brands", label: "Brands" },
  { href: "/for-creators", label: "Creators" },
  { href: "/pricing", label: "Pricing" },
  { href: "/trust", label: "Trust" },
] as const;

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-ground/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-[1180px] items-center gap-8 px-5 sm:px-8">
        <Wordmark />
        <nav aria-label="Main" className="hidden items-center gap-7 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-[14.5px] font-medium text-ink-2 hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button variant="brand" asChild>
            <Link href="/signup">
              <span className="sm:hidden">Start</span>
              <span className="hidden sm:inline">Start a campaign</span>
            </Link>
          </Button>
        </div>
      </div>
      <nav
        aria-label="Main"
        className="flex h-11 items-center gap-6 overflow-x-auto border-t border-line px-5 md:hidden"
      >
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="whitespace-nowrap text-[14px] font-medium text-ink-2"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

const FOOTER = [
  {
    title: "Product",
    links: [
      { href: "/for-agencies", label: "For agencies" },
      { href: "/for-brands", label: "For brands" },
      { href: "/pricing", label: "Pricing" },
      { href: "/trust", label: "Trust and escrow" },
      { href: "/legal/terms", label: "Terms of service" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/login", label: "Sign in" },
      { href: "/signup", label: "Create an account" },
      { href: "/forgot-password", label: "Reset a password" },
    ],
  },
  {
    title: "Creators",
    links: [
      { href: "/for-creators", label: "How it works for you" },
      { href: "/legal/creator-agreement", label: "The creator agreement" },
      { href: "/login", label: "Your deals" },
    ],
  },
] as const;

export function MarketingFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid w-full max-w-[1180px] gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Wordmark />
          <p className="mt-4 font-display text-[18px] font-semibold tracking-[-0.02em]">
            Get the deal. Get paid.
          </p>
          <p className="mt-6 text-[12.5px] leading-relaxed text-ink-3">
            SubSquad Technologies Ltd
            <br />
            Victoria Island, Lagos
          </p>
        </div>
        {FOOTER.map((col) => (
          <div key={col.title}>
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">
              {col.title}
            </p>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-[14.5px] text-ink-2 hover:text-ink"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </footer>
  );
}
