import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * A page that is not there.
 *
 * Next's default is a black screen with "404" in a monospace font. It appeared
 * twice in one day of testing — once at the end of every invite email, once
 * on the ops console — and each time it looked like the platform had crashed.
 * A missing page is ordinary; the screen should say so in the product's own
 * voice and offer the two places most people were trying to reach.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[460px] flex-col items-center justify-center px-5 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-ground">
        <Compass className="size-6 text-ink-3" />
      </span>
      <h1 className="mt-5 text-[24px] font-semibold tracking-[-0.02em]">
        That page is not here
      </h1>
      <p className="mt-2 max-w-[36ch] text-[14px] leading-relaxed text-ink-2">
        The link may be old, or mistyped. Nothing has gone wrong with your
        account or your money.
      </p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Button asChild>
          <Link href="/">Go to your dashboard</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/creator">Creator app</Link>
        </Button>
      </div>
      <p className="mt-8 text-[12.5px] text-ink-3">
        Followed a link from an email? Reply to it and a person will send you
        the right one.
      </p>
    </main>
  );
}
