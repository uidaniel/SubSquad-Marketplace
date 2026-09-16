import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A panel is the only container in the app. Nesting one inside another is a
 * design smell — two borders around the same content reads as two levels of
 * importance that are not really there — so nested panels flatten themselves.
 */
export function Panel({
  className,
  accent,
  ...props
}: React.HTMLAttributes<HTMLElement> & { accent?: boolean }) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface shadow-[var(--shadow-panel)]",
        "[&_section]:rounded-none [&_section]:border-0 [&_section]:bg-transparent [&_section]:shadow-none",
        accent &&
          "before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-brand before:content-['']",
        className,
      )}
      {...props}
    />
  );
}

export function PanelHeader({
  className,
  children,
  action,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { action?: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 border-b border-line px-5 py-3.5",
        className,
      )}
      {...props}
    >
      {children}
      {action}
    </div>
  );
}

export function PanelTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn("text-[14px] font-semibold tracking-[-0.01em]", className)}
      {...props}
    />
  );
}

export function PanelBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}

export function PanelFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "border-t border-line px-5 py-3 text-[12.5px] text-ink-3",
        className,
      )}
      {...props}
    />
  );
}
