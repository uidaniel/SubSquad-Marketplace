import { MessageCircle } from "lucide-react";

/**
 * What a creator sees when we do not know who they are.
 *
 * Creators do not have a password. They arrive from a link sent to their phone,
 * and that link identifies the deal. So landing here without one is not an
 * error to apologise for — it is simply the wrong door, and the page says which
 * door to use.
 *
 * Deliberately not a login form. Offering one would imply an account they were
 * never asked to create, and the most common visitor here is somebody who
 * bookmarked a page rather than the link.
 */
export function NoCreatorSession({
  what = "your deals",
}: {
  what?: string;
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[460px] items-center px-4 py-10">
      <div className="w-full text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-ground">
          <MessageCircle className="size-6 text-ink-3" />
        </span>
        <h1 className="mt-4 text-[21px] font-semibold tracking-[-0.02em]">
          Open the link we sent you
        </h1>
        <p className="mx-auto mt-2 max-w-[36ch] text-[14px] leading-relaxed text-ink-2">
          To see {what}, tap the link in our message to you. It goes straight to
          your deal — no password, nothing to remember.
        </p>
        <p className="mx-auto mt-5 max-w-[34ch] text-[12.5px] leading-relaxed text-ink-3">
          Lost it? Reply to any message from us and a person will send it again.
        </p>
      </div>
    </main>
  );
}
