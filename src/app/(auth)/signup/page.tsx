import Link from "next/link";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Create an account" };

export default function SignupPage() {
  return (
    <>
      <h1 className="text-[26px] font-semibold tracking-[-0.025em]">
        Create an account
      </h1>
      <p className="mt-1.5 text-[14px] text-ink-2">
        Already have one?{" "}
        <Link href="/login" className="font-medium text-brand-ink hover:underline">
          Sign in
        </Link>
      </p>

      <div className="mt-7">
        <SignupForm />
      </div>

      <p className="mt-7 text-[12.5px] leading-relaxed text-ink-3">
        Free to open. You are charged 12% when a deal completes, and nothing
        before that — no subscription, no fee to browse.
      </p>
    </>
  );
}
