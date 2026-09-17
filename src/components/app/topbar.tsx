import Link from "next/link";
import { cn } from "@/lib/utils";
import { Bell, ChevronRight, Search } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { MobileNavButton } from "./mobile-nav-button";

export interface Crumb {
  label: string;
  href?: string;
}

export function Topbar({
  crumbs,
  userName,
  unread,
}: {
  crumbs: Crumb[];
  userName: string;
  unread?: number;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-ground/85 px-4 backdrop-blur-md sm:px-6">
      <MobileNavButton />

      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5">
        {crumbs.map((crumb, i) => (
          <span
            key={`${crumb.label}-${i}`}
            className={cn(
              "flex min-w-0 items-center gap-1.5",
              i < crumbs.length - 1 && "hidden sm:flex",
            )}
          >
            {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-ink-3" />}
            {crumb.href ? (
              <Link
                href={crumb.href}
                className="truncate text-[13px] text-ink-2 transition-colors hover:text-ink"
              >
                {crumb.label}
              </Link>
            ) : (
              <span className="truncate text-[13px] font-medium text-ink">
                {crumb.label}
              </span>
            )}
          </span>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <form
          action="/search"
          role="search"
          className="hidden h-9 items-center gap-2 rounded-[var(--radius-sm)] border border-line bg-surface px-3 md:flex"
        >
          <Search className="size-4 text-ink-3" />
          <input
            name="q"
            type="search"
            placeholder="Search creators, campaigns"
            aria-label="Search"
            className="w-48 bg-transparent text-[13px] outline-none placeholder:text-ink-3"
          />
        </form>

        <Link
          href="/notifications"
          aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
          className="relative grid size-11 place-items-center rounded-[var(--radius-sm)] lg:size-9 text-ink-2 transition-colors hover:bg-surface hover:text-ink"
        >
          <Bell className="size-[18px]" />
          {unread ? (
            <span className="absolute right-2 top-2 size-2 rounded-full bg-brand ring-2 ring-ground" />
          ) : null}
        </Link>

        <Avatar name={userName} size="sm" />
      </div>
    </header>
  );
}
