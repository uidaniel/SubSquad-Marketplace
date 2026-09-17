"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Tabs that switch instantly.
 *
 * They used to be links to `?tab=…`, which meant every click was a full server
 * round trip. These pages read cookies, so Next cannot prefetch them either —
 * the result was a tab that took the better part of a second to respond, on a
 * page where all the data for every tab had already been fetched and sent.
 *
 * So the panels are all rendered and the switch is local. The URL is still kept
 * in step through `replaceState`, so a tab can be linked to and survives a
 * reload, but changing it costs nothing.
 *
 * Inactive panels stay mounted and hidden rather than being unmounted: a half
 * typed note in one tab should still be there when you come back to it.
 */
export function TabGroup({
  tabs,
  initial,
  param = "tab",
  children,
  className,
}: {
  tabs: readonly { key: string; label: string; count?: number }[];
  initial: string;
  /** The query parameter to keep in step. */
  param?: string;
  /** One child per tab, keyed by `data-tab`. */
  children: React.ReactNode;
  className?: string;
}) {
  const [active, setActive] = React.useState(initial);

  const select = (key: string) => {
    setActive(key);
    // History, not navigation. The server has already sent every panel.
    const url = new URL(window.location.href);
    url.searchParams.set(param, key);
    window.history.replaceState(null, "", url.toString());
  };

  const panels = React.Children.toArray(children) as React.ReactElement<{
    "data-tab"?: string;
  }>[];

  return (
    <>
      <div
        role="tablist"
        className={cn(
          "-mx-1 mb-4 flex gap-1 overflow-x-auto border-b border-line px-1",
          className,
        )}
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active === tab.key}
            onClick={() => select(tab.key)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13.5px] font-medium transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              active === tab.key
                ? "border-ink text-ink"
                : "border-transparent text-ink-3 hover:text-ink-2",
            )}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span
                className={cn(
                  "tabular-nums",
                  active === tab.key ? "text-ink-2" : "text-ink-3",
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {panels.map((panel, i) => {
        const key = panel.props?.["data-tab"] ?? tabs[i]?.key;
        return (
          <div
            key={key}
            role="tabpanel"
            hidden={key !== active}
            className={key !== active ? undefined : "contents"}
          >
            {panel}
          </div>
        );
      })}
    </>
  );
}
