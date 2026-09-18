import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { surfaceForHost } from "@/lib/domains";

/**
 * Hostname routing, session refresh, and route protection — in that order.
 *
 * The order matters. Surface is decided first because it changes which paths
 * exist at all. Then the access token is refreshed and its cookies attached to
 * the response — skip that and a user is silently signed out an hour into their
 * day. Only then is the route checked.
 *
 * `getUser()` is used rather than `getSession()` because it verifies the token
 * with Supabase instead of trusting the cookie. Middleware that trusts a
 * forgeable cookie is not protecting anything.
 */

/** Reachable without signing in. Everything else on the org app needs a session. */
const PUBLIC_PREFIXES = [
  // The marketing site. "/" itself is rewritten to /home for visitors below.
  "/home",
  "/for-agencies",
  "/for-creators",
  "/pricing",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password", // reached with the session the recovery link created
  "/legal",
  "/auth",
  "/i/", // creator invite links, opened from WhatsApp
  "/d/", // guest brand payment links
  "/join/", // team invitations, opened before the person has an account
  "/payments/", // the post-payment landing page
  "/api/webhooks",
  // Reachable signed-out on purpose: the misconfiguration it reports is usually
  // the reason nobody can sign in.
  "/api/health",
];

const DEMO_MODE =
  process.env.DEMO_MODE === "true" ||
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const surface = surfaceForHost(request.headers.get("host"));

  /* ----------------------------------------------------------------------
     creator.<domain> — the creator app, served from /creator internally.
     ---------------------------------------------------------------------- */
  if (surface === "creator") {
    // Shared public pages keep their own paths on both surfaces: an invite link
    // must resolve identically wherever it was opened from.
    const isShared = ["/i/", "/d/", "/payments/", "/api/", "/auth"].some((p) =>
      pathname.startsWith(p),
    );

    if (!isShared && !pathname.startsWith("/creator")) {
      const url = request.nextUrl.clone();
      url.pathname = pathname === "/" ? "/creator" : `/creator${pathname}`;
      // A rewrite, not a redirect: the address bar keeps creator.subsquad.ng/wallet
      // rather than exposing the internal /creator prefix.
      return NextResponse.rewrite(url);
    }

    // The org app is not reachable from this hostname, so a stray link cannot
    // bounce a creator into a sign-in screen meant for agencies.
    if (pathname.startsWith("/ops") || pathname.startsWith("/campaigns")) {
      const url = request.nextUrl.clone();
      url.pathname = "/creator";
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }

  /* ----------------------------------------------------------------------
     The org app.
     ---------------------------------------------------------------------- */

  // With no Supabase project there is nobody to sign in as and the app serves
  // fixtures, so this keeps `npm run dev` on an empty .env working.
  if (DEMO_MODE) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // A cookie that cannot be parsed or refreshed is a signed-out user, not a
  // server error. Supabase throws here when a token is malformed or its signing
  // key has rotated, and letting that propagate takes down the sign-in page —
  // which is the one page somebody in that state needs to reach.
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    const cleared = NextResponse.redirect(url);
    // Clear them rather than leave the loop to repeat on the next request.
    for (const cookie of request.cookies.getAll()) {
      if (cookie.name.startsWith("sb-")) cleared.cookies.delete(cookie.name);
    }
    return cleared;
  }

  const isPublic = PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix),
  );

  // The front door. A visitor at the root gets the marketing site; somebody
  // signed in gets their dashboard. A rewrite, so the address stays "/" and
  // the same link works for both.
  if (!user && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/home";
    return NextResponse.rewrite(url);
  }

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Come back to where they were going, not to the dashboard.
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // A signed-in user has no business on the sign-in page.
  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except Next's own assets and image files. An auth check on a
     * font request costs latency and protects nothing.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)",
  ],
};
