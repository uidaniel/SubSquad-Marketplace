"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, Plus, User, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = {
  deals: Briefcase,
  wallet: Wallet,
  new: Plus,
  profile: User,
} as const;

export function CreatorTabBar({
  tabs,
}: {
  tabs: { href: string; label: string; icon: keyof typeof ICONS }[];
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ground/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
    >
      <div className="mx-auto flex w-full max-w-[560px]">
        {tabs.map((tab) => {
          const Icon = ICONS[tab.icon];
          const active =
            tab.href === "/creator"
              ? pathname === "/creator"
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-[54px] flex-1 flex-col items-center justify-center gap-0.5 text-[12px] font-medium transition-colors",
                active ? "text-ink" : "text-ink-3",
              )}
            >
              <Icon className={cn("size-[18px]", active && "text-brand")} />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
