import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./reset-form";

export const metadata = { title: "Choose a new password" };

/**
 * The second half: the link brought them here with a session.
 *
 * Supabase's recovery link goes through /auth/callback, which trades the code
 * for a session and forwards to this page. So a visitor with no session did
 * not come from a link — they typed the address, or the link expired. Either
 * way the answer is the same: ask for a fresh one.
 */
export default async function ResetPasswordPage() {
  const supabase = await createClient();
  let user = null;
  try {
    user = (await supabase.auth.getUser()).data.user;
  } catch {
    user = null;
  }
  if (!user) redirect("/forgot-password?expired=1");

  return (
    <>
      <h1 className="text-[26px] font-semibold tracking-[-0.025em]">
        Choose a new password
      </h1>
      <p className="mt-1.5 text-[14px] text-ink-2">
        For <b className="font-medium text-ink">{user.email}</b>. At least 8
        characters; longer is better than complicated.
      </p>

      <div className="mt-7">
        <ResetPasswordForm />
      </div>

      <p className="mt-7 text-[12.5px] leading-relaxed text-ink-3">
        Changing it signs out every other device. If that was not you asking,{" "}
        <Link href="/login" className="font-medium text-brand-ink hover:underline">
          sign in
        </Link>{" "}
        and change it again from Settings.
      </p>
    </>
  );
}
