"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createOrgForUser } from "@/lib/auth/session";

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
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "That email and password do not match an account." };
  }

  revalidatePath("/", "layout");
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

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });

  if (error) {
    return { error: error.message };
  }

  // With email confirmation on, there is no session yet and nothing to do until
  // they click the link. Saying so plainly beats a spinner that never resolves.
  if (!data.session) {
    redirect("/signup/check-email");
  }

  revalidatePath("/", "layout");
  redirect("/signup/org");
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
