"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type ActionResult = { ok: boolean; message: string };

/**
 * What to ask before running.
 *
 * A string is still accepted, but the shaped form is what these actions
 * deserve: the question is the heading, the consequence is the body, and the
 * confirming button repeats the action rather than saying "OK" — so the last
 * thing read before money moves is the amount, not a generic word.
 */
export type Confirmation = {
  title: string;
  body?: string;
  /** Defaults to "Confirm". Name the action and the amount. */
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` for anything that cannot be pulled back, such as a payout. */
  tone?: "default" | "danger";
};

/**
 * A button that runs a server action and says what happened.
 *
 * Actions here move money and send messages to real people, so the result is
 * never swallowed: the outcome appears next to the button that caused it, in
 * the words the action returned. A refusal is not an error dialog — it is a
 * sentence explaining what to do instead.
 *
 * After a successful run the button disables itself. The server revalidates the
 * page, but that takes a moment on a slow connection, and in that moment the
 * old button is still on screen and still pressable — which is how a campaign
 * got funded twice. The action layer refuses a duplicate anyway; this stops the
 * person ever having reason to think they need to press again.
 */
export function ActionButton({
  action,
  confirm,
  children,
  className,
  onDone,
  ...props
}: Omit<ButtonProps, "onClick"> & {
  action: () => Promise<ActionResult>;
  /** Shown before running, for anything that cannot be undone. */
  confirm?: string | Confirmation;
  onDone?: (result: ActionResult) => void;
}) {
  const [pending, startTransition] = React.useTransition();
  const [result, setResult] = React.useState<ActionResult | null>(null);
  const [asking, setAsking] = React.useState(false);

  const ask: Confirmation | null =
    typeof confirm === "string" ? { title: confirm } : (confirm ?? null);

  const succeeded = result?.ok === true;

  const run = () => {
    setAsking(false);
    startTransition(async () => {
      const outcome = await action();
      setResult(outcome);
      onDone?.(outcome);
    });
  };

  return (
    <span className="inline-flex w-full flex-col items-start gap-1.5">
      <Button
        {...props}
        className={className}
        onClick={() => (ask ? setAsking(true) : run())}
        disabled={pending || succeeded || props.disabled}
      >
        {pending ? <Loader2 className="animate-spin" /> : null}
        {children}
      </Button>

      {result && (
        <span
          role="status"
          className={cn(
            "max-w-prose text-[12.5px] leading-snug",
            result.ok ? "text-ok" : "text-danger",
          )}
        >
          {result.message}
        </span>
      )}

      {ask && (
        <Dialog open={asking} onOpenChange={setAsking}>
          <DialogContent>
            <div className="space-y-2">
              <DialogTitle>{ask.title}</DialogTitle>
              {ask.body && <DialogDescription>{ask.body}</DialogDescription>}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">{ask.cancelLabel ?? "Cancel"}</Button>
              </DialogClose>
              <Button
                variant={ask.tone === "danger" ? "danger" : "default"}
                onClick={run}
                autoFocus
              >
                {ask.confirmLabel ?? "Confirm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </span>
  );
}
