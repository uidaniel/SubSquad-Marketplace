"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * The console's sections, with a count on each.
 *
 * The counts are the point: an ops person opening this should see where the
 * work is without clicking into four empty queues. A zero shows no badge at
 * all rather than a grey "0", so the eye goes only to what is waiting.
 */
const TABS = [
  { href: "/ops", label: "Triage", key: null },
  { href: "/ops/verification", label: "Verification", key: "verification" },
  { href: "/ops/disputes", label: "Disputes", key: "disputes" },
  { href: "/ops/payouts", label: "Failed payouts", key: "payouts" },
  { href: "/ops/webhooks", label: "Webhooks", key: "webhooks" },
] as const;

export function OpsTabs({
  counts,
}: {
  counts: Record<string, number>;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-line">
      {TABS.map((tab) => {
        const active =
          tab.href === "/ops" ? pathname === "/ops" : pathname.startsWith(tab.href);
        const count = tab.key ? counts[tab.key] : 0;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-[13.5px] font-medium transition-colors",
              active
                ? "border-ink text-ink"
                : "border-transparent text-ink-2 hover:text-ink",
            )}
          >
            {tab.label}
            {count > 0 && (
              <span className="rounded-full bg-brand px-1.5 py-0.5 text-[12px] font-semibold leading-none text-white tabular-nums">
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
