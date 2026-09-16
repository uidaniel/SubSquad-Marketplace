"use client";

import { Menu } from "lucide-react";

/** The event the rail listens for. Keeps the trigger and the drawer decoupled,
 *  so the topbar can stay a server component rendered per page. */
export const NAV_TOGGLE_EVENT = "subsquad:toggle-nav";

export function MobileNavButton() {
  return (
    <button
      type="button"
      aria-label="Open navigation"
      onClick={() => window.dispatchEvent(new CustomEvent(NAV_TOGGLE_EVENT))}
      className="-ml-1 grid size-9 shrink-0 place-items-center rounded-[var(--radius-sm)] text-ink-2 transition-colors hover:bg-surface hover:text-ink lg:hidden"
    >
      <Menu className="size-[18px]" />
    </button>
  );
}
