import Link from "next/link";
import { MailCheck } from "lucide-react";

export const metadata = { title: "Check your email" };

/**
 * Where sign-up ends when the project requires email confirmation.
 *
 * Saying so plainly beats leaving someone on a form that appeared to do
 * nothing — which is what they would otherwise see, since no session exists
 * until they click the link.
 */
export default function CheckEmailPage() {
  return (
    <>
      <span className="grid size-11 place-items-center rounded-[12px] bg-ok-soft">
        <MailCheck className="size-5 text-ok" />
      </span>

      <h1 className="mt-5 text-[26px] font-semibold tracking-[-0.025em]">
        Check your email
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
        We sent you a link to confirm your address. Open it and you will come
        straight back here to finish setting up your company.
      </p>

      <p className="mt-6 text-[13px] leading-relaxed text-ink-3">
        Nothing in your inbox after a minute or two? Check spam — then{" "}
        <Link href="/signup" className="font-medium text-brand-ink hover:underline">
          try again
        </Link>
        .
      </p>

      <p className="mt-8 text-[13px] text-ink-2">
        Already confirmed?{" "}
        <Link href="/login" className="font-medium text-brand-ink hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
