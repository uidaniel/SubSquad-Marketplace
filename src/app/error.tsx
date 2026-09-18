"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Something threw while rendering.
 *
 * Next's default here is "Application error: a server-side exception has
 * occurred" and a digest nobody can do anything with. This says what is true
 * — the page failed, the money did not — offers the one action that usually
 * works, and keeps the digest where support can read it back.
 *
 * `instrumentation.ts` has already written the full error to server_errors by
 * the time this renders, so nothing is lost by keeping the screen calm.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[460px] flex-col items-center justify-center px-5 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-warn-soft">
        <AlertTriangle className="size-6 text-warn" />
      </span>
      <h1 className="mt-5 text-[24px] font-semibold tracking-[-0.02em]">
        This page did not load
      </h1>
      <p className="mt-2 max-w-[38ch] text-[14px] leading-relaxed text-ink-2">
        Something on our side failed while drawing it. Your account and any
        money in escrow are unaffected — the ledger is separate from the screen.
      </p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Button onClick={reset}>
          <RotateCcw /> Try again
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">Go to your dashboard</Link>
        </Button>
      </div>
      {error.digest && (
        <p className="mt-8 font-mono text-[11.5px] text-ink-3">
          Reference {error.digest}
        </p>
      )}
    </main>
  );
}
