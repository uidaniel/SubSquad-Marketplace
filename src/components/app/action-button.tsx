"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ActionResult = { ok: boolean; message: string };

/**
 * A button that runs a server action and says what happened.
 *
 * Actions here move money and send messages to real people, so the result is
 * never swallowed: the outcome appears next to the button that caused it, in
 * the words the action returned. A refusal is not an error dialog — it is a
 * sentence explaining what to do instead.
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
  confirm?: string;
  onDone?: (result: ActionResult) => void;
}) {
  const [pending, startTransition] = React.useTransition();
  const [result, setResult] = React.useState<ActionResult | null>(null);

  const run = () => {
    if (confirm && !window.confirm(confirm)) return;
    startTransition(async () => {
      const outcome = await action();
      setResult(outcome);
      onDone?.(outcome);
    });
  };

  return (
    <span className="inline-flex flex-col items-start gap-1.5">
      <Button
        {...props}
        className={className}
        onClick={run}
        disabled={pending || props.disabled}
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
    </span>
  );
}
