"use client";

import * as React from "react";
import Link from "next/link";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Building2, ChevronDown, LogOut, Settings, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "@/app/(auth)/actions";

/**
 * The account button in the sidebar.
 *
 * It had a chevron and no menu — it looked like a switcher and did nothing,
 * which is worse than no chevron at all. This is the one place in the app that
 * names which client account you are working in, so it is also the right place
 * to reach that account's settings and to sign out.
 */
export function OrgMenu({
  orgName,
  orgSubtitle,
  initials,
}: {
  orgName: string;
  orgSubtitle: string;
  initials: string;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={cn(
          "mb-4 flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] border border-white/10 px-2.5 py-2 text-left transition-colors",
          "hover:bg-white/5 data-[state=open]:bg-white/5",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        )}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-info text-[12px] font-semibold text-white lg:size-7 lg:text-[11px]">
          {initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-white">
            {orgName}
          </span>
          <span className="block truncate text-[12.5px] text-chrome-ink/50 lg:text-[11.5px]">
            {orgSubtitle}
          </span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-chrome-ink/50" />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className="z-50 min-w-[220px] overflow-hidden rounded-[var(--radius-md)] border border-line bg-surface p-1 shadow-[var(--shadow-pop)]"
        >
          <DropdownMenu.Label className="px-2.5 py-2 text-[11.5px] font-medium uppercase tracking-wide text-ink-3">
            {orgName}
          </DropdownMenu.Label>

          <Item href="/spaces" icon={<Users className="size-4" />}>
            Clients and wallets
          </Item>
          <Item href="/settings" icon={<Settings className="size-4" />}>
            Account settings
          </Item>
          <Item href="/reports" icon={<Building2 className="size-4" />}>
            Reports
          </Item>

          <DropdownMenu.Separator className="my-1 h-px bg-line" />

          {/* The server action, so the session cookie is cleared server-side
              rather than merely forgotten by this tab. */}
          <DropdownMenu.Item asChild>
            <form action={signOut}>
              <button
                type="submit"
                className="flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-left text-[13px] text-ink-2 outline-none hover:bg-ground focus-visible:bg-ground"
              >
                <LogOut className="size-4" />
                Sign out
              </button>
            </form>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function Item({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu.Item asChild>
      <Link
        href={href}
        className="flex items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-[13px] text-ink-2 outline-none hover:bg-ground focus-visible:bg-ground"
      >
        {icon}
        {children}
      </Link>
    </DropdownMenu.Item>
  );
}
