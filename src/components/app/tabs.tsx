import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Tabs, as links.
 *
 * Each tab is a real URL rather than client state, so a tab can be linked to,
 * opened in a new tab, refreshed, and reached from the "needs your action" list
 * directly. It also means a tab renders on the server with its own data instead
 * of every panel being mounted at once and hidden with CSS.
 */
export interface TabDef {
  key: string;
  label: string;
  count?: number;
}

export function Tabs({
  tabs,
  active,
  basePath,
  className,
}: {
  tabs: TabDef[];
  active: string;
  /** Tab key is appended as ?tab=… so the rest of the query is preserved. */
  basePath: string;
  className?: string;
}) {
  return (
    <nav
      aria-label="Sections"
      className={cn("mb-6 flex gap-1 overflow-x-auto border-b border-line", className)}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={`${basePath}?tab=${tab.key}`}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-[13.5px] transition-colors",
              isActive
                ? "border-ink font-medium text-ink"
                : "border-transparent text-ink-2 hover:text-ink",
            )}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span
                className={cn(
                  "rounded-full px-1.5 text-[11px] tabular-nums",
                  isActive ? "bg-ink text-white" : "bg-line text-ink-2",
                )}
              >
                {tab.count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
