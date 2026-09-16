import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Form fields.
 *
 * Inputs are 16px on small screens because iOS zooms the page on focus for
 * anything smaller, and the creator app is used on a phone one-handed. The hint
 * sits under the label rather than in a placeholder, so it is still readable
 * once the field has been filled in.
 */

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-[13px] font-medium">
        {label}
      </label>
      {hint && <p className="text-[12.5px] leading-snug text-ink-2">{hint}</p>}
      {children}
      {error && <p className="text-[12.5px] text-danger">{error}</p>}
    </div>
  );
}

const control =
  "w-full rounded-[var(--radius-sm)] border border-line-strong bg-surface px-3 py-2.5 text-[16px] sm:text-[14px] " +
  "placeholder:text-ink-3 focus:border-ink focus:outline-none focus:ring-3 focus:ring-ink/8 disabled:opacity-60";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(control, "min-h-11", className)} {...props} />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(control, "min-h-24 resize-y", className)}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select ref={ref} className={cn(control, "min-h-11 pr-9", className)} {...props}>
    {children}
  </select>
));
Select.displayName = "Select";

/** A naira field, with the symbol shown rather than expected in the input. */
export function MoneyInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative flex items-center">
      <span className="pointer-events-none absolute left-3 text-[16px] text-ink-2 sm:text-[14px]">
        ₦
      </span>
      <input
        inputMode="numeric"
        className={cn(control, "min-h-11 pl-7 font-medium tabular-nums", className)}
        {...props}
      />
    </div>
  );
}
