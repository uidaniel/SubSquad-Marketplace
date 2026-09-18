import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * A missing page, inside the app shell.
 *
 * The root not-found covers links from outside. This one renders with the
 * sidebar still in place — for a route that exists but refused, like the ops
 * console for somebody who is not staff — so the person keeps their bearings
 * instead of being dropped onto a bare screen.
 */
export default function AppNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-[460px] flex-1 flex-col items-center justify-center px-5 py-16 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-ground">
        <Compass className="size-6 text-ink-3" />
      </span>
      <h1 className="mt-5 text-[22px] font-semibold tracking-[-0.02em]">
        That page is not here
      </h1>
      <p className="mt-2 max-w-[36ch] text-[14px] leading-relaxed text-ink-2">
        Either the link is old, or it points at something your account cannot
        see. Nothing has gone wrong with your money.
      </p>
      <Button className="mt-6" asChild>
        <Link href="/">Back to your dashboard</Link>
      </Button>
    </main>
  );
}
