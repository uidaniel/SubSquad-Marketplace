"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote,
  Building2,
  Check,
  ChevronDown,
  LayoutDashboard,
  MessageSquare,
  Receipt,
  Settings,
  Shield,
  Users,
} from "lucide-react";
import { cn, initialsOf } from "@/lib/utils";
import { formatNaira } from "@/lib/money";

/**
 * The rail.
 *
 * Three bands that never fight for space: the account at the top, navigation in
 * the middle, and money plus the signed-in person pinned to the bottom. The
 * escrow figure lives here rather than on every screen so no page has to spend
 * a card repeating it.
 */

export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  count?: number;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

const ICONS = {
  dashboard: LayoutDashboard,
  campaigns: Receipt,
  approvals: Check,
  outreach: MessageSquare,
  creators: Users,
  clients: Building2,
  wallet: Banknote,
  ops: Shield,
  settings: Settings,
} as const;

export function Sidebar({
  orgName,
  orgSubtitle,
  groups,
  escrowKobo,
  escrowNote,
  userName,
  userRole,
  showOps,
}: {
  orgName: string;
  orgSubtitle: string;
  groups: NavGroup[];
  escrowKobo: number;
  escrowNote: string;
  userName: string;
  userRole: string;
  showOps: boolean;
}) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col bg-chrome px-3 pt-4 pb-4 text-chrome-ink lg:flex">
      <Link
        href="/"
        className="mb-3 flex items-center gap-2 px-2 py-1 text-[15px] font-semibold text-white"
      >
        <span className="grid size-6 place-items-center rounded-[6px] bg-brand text-[11px] font-bold text-white">
          SS
        </span>
        SubSquad
      </Link>

      <button
        type="button"
        className="mb-4 flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] border border-white/10 px-2.5 py-2 text-left transition-colors hover:bg-white/5"
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-info text-[11px] font-semibold text-white">
          {initialsOf(orgName)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-white">
            {orgName}
          </span>
          <span className="block truncate text-[11.5px] text-chrome-ink/50">
            {orgSubtitle}
          </span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-chrome-ink/50" />
      </button>

      <nav className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none]">
        {groups.map((group) => (
          <div key={group.label} className="mb-4">
            <p className="px-2.5 pb-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-chrome-ink/40">
              {group.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const Icon = ICONS[item.icon];
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-[34px] items-center gap-2.5 rounded-[7px] px-2.5 text-[13.5px] transition-colors",
                      active
                        ? "bg-white/10 font-medium text-white"
                        : "text-chrome-ink/75 hover:bg-white/5 hover:text-white",
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-[17px] shrink-0",
                        active ? "text-brand" : "text-chrome-ink/50",
                      )}
                    />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.count ? (
                      <span className="rounded-full bg-white/10 px-1.5 text-[11px] tabular-nums">
                        {item.count}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 pt-3">
        <div className="rounded-[var(--radius-sm)] bg-white/[0.06] px-3 py-2.5">
          <p className="text-[11px] text-chrome-ink/50">Held in escrow</p>
          <p className="mt-0.5 text-[17px] font-semibold tabular-nums text-white">
            {formatNaira(escrowKobo)}
          </p>
          <p className="mt-1 text-[11px] leading-snug text-chrome-ink/45">
            {escrowNote}
          </p>
        </div>

        <div className="my-3 h-px bg-white/10" />

        {showOps && (
          <Link
            href="/ops"
            className="flex h-[34px] items-center gap-2.5 rounded-[7px] px-2.5 text-[13.5px] text-chrome-ink/75 transition-colors hover:bg-white/5 hover:text-white"
          >
            <Shield className="size-[17px] text-chrome-ink/50" />
            Ops console
          </Link>
        )}
        <Link
          href="/settings"
          className="flex h-[34px] items-center gap-2.5 rounded-[7px] px-2.5 text-[13.5px] text-chrome-ink/75 transition-colors hover:bg-white/5 hover:text-white"
        >
          <Settings className="size-[17px] text-chrome-ink/50" />
          Settings
        </Link>

        <div className="my-3 h-px bg-white/10" />

        <button
          type="button"
          className="flex w-full items-center gap-2.5 rounded-[7px] px-2.5 py-1.5 text-left transition-colors hover:bg-white/5"
        >
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ok text-[11px] font-semibold text-white">
            {initialsOf(userName)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] text-white">{userName}</span>
            <span className="block truncate text-[11.5px] text-chrome-ink/50">
              {userRole}
            </span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-chrome-ink/50" />
        </button>
      </div>
    </aside>
  );
}
