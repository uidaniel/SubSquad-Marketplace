import Link from "next/link";
import { ForgotPasswordForm } from "./forgot-form";

export const metadata = { title: "Reset your password" };

/**
 * The first half of a password reset.
 *
 * There was no way to reset a password at all. Anyone who forgot theirs was
 * locked out of an account with a client's money in it, with nothing to do but
 * email us. For a platform holding escrow that is not a missing feature, it is
 * a support ticket waiting to become a refund.
 */
export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-[26px] font-semibold tracking-[-0.025em]">
        Reset your password
      </h1>
      <p className="mt-1.5 text-[14px] text-ink-2">
        Enter the email you signed up with and we will send a link. It works
        once and expires in an hour.
      </p>

      <div className="mt-7">
        <ForgotPasswordForm />
      </div>

      <p className="mt-7 text-[13px] text-ink-2">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-brand-ink hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
