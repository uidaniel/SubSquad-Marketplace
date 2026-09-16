import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Status is never carried by colour alone — every badge shows its label, so the
 * same information survives a colourblind reader, a greyscale print and a
 * screenshot pasted into WhatsApp.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-[var(--radius-xs)] px-2 py-0.5 text-[12px] font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "bg-ground text-ink-2",
        ok: "bg-ok-soft text-ok",
        warn: "bg-warn-soft text-warn",
        danger: "bg-danger-soft text-danger",
        info: "bg-info-soft text-info",
        brand: "bg-brand/10 text-brand-ink",
      },
      dot: { true: "", false: "" },
    },
    defaultVariants: { tone: "neutral", dot: false },
  },
);

const DOT_TONES: Record<string, string> = {
  neutral: "bg-ink-3",
  ok: "bg-ok",
  warn: "bg-warn",
  danger: "bg-danger",
  info: "bg-info",
  brand: "bg-brand",
};

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {dot && (
        <span
          aria-hidden
          className={cn("size-1.5 rounded-full", DOT_TONES[tone ?? "neutral"])}
        />
      )}
      {children}
    </span>
  );
}
