"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createOrgForUser } from "@/lib/auth/session";
import { env } from "@/lib/env";

/**
 * Sign in, sign up, sign out.
 *
 * These return a message rather than throwing, because every failure here is
 * something the person can fix — a typo, a password, an email already in use —
 * and an error page helps with none of them.
 *
 * Supabase's own errors are deliberately not passed through verbatim: they leak
 * whether an email exists, which is a way of enumerating a platform's customers.
 */

export type AuthResult = { error: string } | undefined;

function safeNext(next: string | null | undefined): string {
  // Only same-origin paths. An open redirect on a login form is how phishing
  // links get their credibility.
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

export async function signIn(
  _prev: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? ""));

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "That email and password do not match an account." };
  }

  revalidatePath("/", "layout");

  // Where "/" means depends on who just signed in. A creator has no org, so
  // the dashboard would bounce them into agency sign-up; their home is
  // /creator. An explicit `next` always wins — it is where they were going.
  if (next === "/" && data.user) {
    const { data: creator } = await supabase
      .from("creators")
      .select("id")
      .eq("user_id", data.user.id)
      .maybeSingle();
    if (creator) redirect("/creator");
  }

  redirect(next);
}

export async function signUp(
  _prev: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (!email || !password || !name) {
    return { error: "Fill in your name, email and a password." };
  }
  if (password.length < 8) {
    return { error: "Use at least 8 characters for your password." };
  }

  // Where to send them afterwards, and whether they are an agency at all.
  //
  // A creator arriving from an invite is not signing up a company. Sending them
  // through "tell us about your organisation" asks a person who makes TikToks
  // for their CAC number, and it is the wrong question at the worst moment.
  const next = safeNext(String(formData.get("next") ?? ""));
  const isCreator = next.startsWith("/i/");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name, role: isCreator ? "creator" : "org" },
      // Carried through the confirmation link, so a creator who has to check
      // their email still lands back on the invite rather than at the door.
      emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  // With email confirmation on, there is no session yet and nothing to do until
  // they click the link. Saying so plainly beats a spinner that never resolves.
  if (!data.session) {
    redirect(`/signup/check-email?next=${encodeURIComponent(next)}`);
  }

  revalidatePath("/", "layout");
  redirect(isCreator ? next : "/signup/org");
}

/** The second half of signing up: the company the person is signing up for. */
export async function createOrg(
  _prev: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  const type = String(formData.get("type") ?? "agency") as "agency" | "brand";
  const name = String(formData.get("name") ?? "").trim();
  const cacNumber = String(formData.get("cacNumber") ?? "").trim();
  const firstSpaceName = String(formData.get("firstSpaceName") ?? "").trim();

  if (!name) return { error: "What is the company called?" };
  if (type !== "agency" && type !== "brand") {
    return { error: "Choose whether this is an agency or a brand." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const result = await createOrgForUser({
    userId: user.id,
    type,
    name,
    cacNumber,
    firstSpaceName: type === "agency" ? firstSpaceName : name,
  });

  if ("error" in result) return { error: result.error };

  // Welcome them now that there is something to do. Failure here must never
  // block the account that was just created.
  try {
    const { welcomeEmail } = await import("@/lib/messaging/email-templates");
    const { sendTransactional } = await import("@/lib/messaging/send");
    const mail = welcomeEmail({
      firstName: String(user.user_metadata?.name ?? "there").split(" ")[0],
      orgName: name,
      isAgency: type === "agency",
      dashboardUrl: `${env.NEXT_PUBLIC_APP_URL}/`,
    });
    if (user.email) {
      await sendTransactional({
        channel: "email",
        to: { email: user.email },
        subject: mail.subject,
        body: mail.html,
        text: mail.text,
        label: `welcome ${name}`,
      });
    }
  } catch {
    // Logged by the sender. The account exists either way.
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  // Local scope signs out this browser only. Supabase defaults to global, which
  // would revoke every session the person has — signing out on a laptop would
  // silently sign them out on their phone. Signing out everywhere is a separate,
  // deliberate action, not what this button means.
  await supabase.auth.signOut({ scope: "local" });
  revalidatePath("/", "layout");
  redirect("/login");
}

/* ==========================================================================
   Password reset
   ========================================================================== */

export type ResetRequestResult = { sent: true; email: string } | { error: string } | undefined;

/**
 * Sends the reset link.
 *
 * Always reports success for a well-formed address. Supabase itself will not
 * send to an email it does not know, but telling the visitor that would let
 * anyone check which of their targets have an account here.
 */
export async function requestPasswordReset(
  _prev: ResetRequestResult,
  formData: FormData,
): Promise<ResetRequestResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "That does not look like an email address." };
  }

  const supabase = await createClient();
  // The link lands on /auth/callback, which trades the code for a session and
  // forwards to the page where the new password is chosen.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
  });

  return { sent: true, email };
}

/** Sets the new password on the session the recovery link created. */
export async function updatePassword(
  _prev: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) {
    return { error: "Use at least 8 characters." };
  }
  if (password !== confirm) {
    return { error: "Those two do not match. Type them again." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.updateUser({ password });

  if (error || !data.user) {
    return {
      error: "That reset link has expired. Ask for a new one and try again.",
    };
  }

  // Every other device is signed out. Whoever asked for the reset now holds
  // the only session, which is the point of resetting.
  await supabase.auth.signOut({ scope: "others" });

  revalidatePath("/", "layout");

  const { data: creator } = await supabase
    .from("creators")
    .select("id")
    .eq("user_id", data.user.id)
    .maybeSingle();
  redirect(creator ? "/creator" : "/");
}

/* ==========================================================================
   Account security (signed in)
   ========================================================================== */

/**
 * Changing a password from inside the account.
 *
 * The reset flow covers somebody locked out. This covers somebody who is in
 * and wants a new one — after a laptop went missing, or a password turned up
 * in a breach. Other devices are signed out for the same reason as a reset.
 */
export async function changePassword(
  _prev: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) return { error: "Use at least 8 characters." };
  if (password !== confirm) return { error: "Those two do not match." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "Could not change it just now. Try again." };

  await supabase.auth.signOut({ scope: "others" });
  return undefined;
}

/** Every session but this one. The laptop-left-on-the-train button. */
export async function signOutEverywhereElse(): Promise<AuthResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) return { error: "Could not do that just now. Try again." };
  return undefined;
}
