import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Where an email confirmation link lands.
 *
 * Supabase sends the person here with a one-time code; this trades it for a
 * session and then sends them on to wherever they were going. Without it, the
 * link in a confirmation email is a 404 — and the person who clicks it has
 * already given us their password and has nothing to show for it.
 *
 * `next` is checked rather than trusted. An open redirect on an auth callback
 * is how a phishing link borrows a real domain's credibility.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  // Same-origin paths only.
  const destination =
    next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (!code) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("That link is missing its code. Ask for a new one.")}`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Expired or already used. Both are ordinary, and both need the same thing.
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("That link has expired or was already used. Sign in, or ask for a new one.")}`,
    );
  }

  return NextResponse.redirect(`${origin}${destination}`);
}
