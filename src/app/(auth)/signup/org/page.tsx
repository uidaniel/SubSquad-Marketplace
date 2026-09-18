import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import { OrgForm } from "./org-form";
import { signOut } from "@/app/(auth)/actions";

export const metadata = { title: "About your company" };

/**
 * Step two: the company.
 *
 * Reached by someone who has an account but no org — either straight from
 * sign-up, or because they closed the tab halfway through and came back.
 */
export default async function CreateOrgPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Already finished; nothing to do here.
  const session = await getSession();
  if (session) redirect("/");

  return (
    <>
      <h1 className="text-[26px] font-semibold tracking-[-0.025em]">
        About your company
      </h1>
      <p className="mt-1.5 text-[14px] text-ink-2">
        This decides how your account works, so it is worth getting right.
      </p>
      {/* Who this is for. Somebody signed in on a shared laptop, or with the
          wrong account, was being asked for a company they do not run with
          no way to say "not me". */}
      <form action={signOut} className="mt-3 flex flex-wrap items-center gap-x-1.5 text-[12.5px] text-ink-3">
        <span>
          Signed in as <span className="font-medium text-ink-2">{user.email}</span>.
        </span>
        <span>Not you?</span>
        <button type="submit" className="font-medium text-brand-ink hover:underline">
          Sign out
        </button>
      </form>

      <div className="mt-7">
        <OrgForm />
      </div>
    </>
  );
}
