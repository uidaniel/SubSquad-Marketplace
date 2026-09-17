"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

/**
 * A modal dialog.
 *
 * Radix handles the parts that are easy to get wrong and invisible when you do:
 * focus moves into the dialog and is trapped there, Escape and the overlay
 * close it, the page behind stops scrolling, and the title is announced to a
 * screen reader as the dialog's name.
 *
 * On a phone it sits at the bottom of the screen rather than the middle, within
 * reach of a thumb, and the buttons stack full-width — a row of two buttons at
 * 375px leaves each one too narrow to read and too close to its neighbour.
 */

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          "fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px]",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
        )}
      />
      <DialogPrimitive.Content
        className={cn(
          "fixed z-50 flex flex-col gap-4 border border-line bg-surface shadow-[var(--shadow-lift)]",
          // Phone: a sheet against the bottom edge, clear of the home indicator.
          "inset-x-0 bottom-0 rounded-t-[var(--radius-xl)] p-5",
          "pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]",
          "data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-4",
          "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom-4",
          // From sm up: centred, and no longer full-bleed.
          "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-[26rem]",
          "sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[var(--radius-lg)] sm:p-6 sm:pb-6",
          "sm:data-[state=open]:zoom-in-95 sm:data-[state=open]:slide-in-from-bottom-0",
          "sm:data-[state=closed]:zoom-out-95 sm:data-[state=closed]:slide-out-to-bottom-0",
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn(
        "text-[16px] font-semibold leading-snug tracking-[-0.01em] text-ink",
        className,
      )}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn("text-[13.5px] leading-relaxed text-ink-2", className)}
      {...props}
    />
  );
}

/**
 * The button row.
 *
 * Reversed on a phone so the confirming action sits at the bottom, nearest the
 * thumb, while still coming first in the DOM — which is the order a keyboard
 * and a screen reader follow.
 */
export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        "[&>button]:w-full sm:[&>button]:w-auto",
        className,
      )}
      {...props}
    />
  );
}
