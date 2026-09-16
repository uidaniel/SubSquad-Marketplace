import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import { OrgForm } from "./org-form";

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

      <div className="mt-7">
        <OrgForm />
      </div>
    </>
  );
}
