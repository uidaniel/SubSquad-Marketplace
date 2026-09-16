import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Session refresh and route protection.
 *
 * Two jobs, and the order matters. First the access token is refreshed and the
 * new cookies are attached to the response — skip this and a user is silently
 * signed out an hour into their day. Only then is the route checked.
 *
 * `getUser()` is used rather than `getSession()` because it verifies the token
 * with Supabase rather than trusting whatever is in the cookie. A middleware
 * that trusts a forgeable cookie is not protecting anything.
 */

/** Reachable without signing in. Everything else requires a session. */
const PUBLIC_PREFIXES = [
  "/login",
  "/signup",
  "/auth", // callback + sign-out routes
  "/i/", // creator invite links
  "/d/", // guest brand payment links
  "/api/webhooks",
];

const DEMO_MODE =
  process.env.DEMO_MODE === "true" ||
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function middleware(request: NextRequest) {
  // With no Supabase project there is nobody to sign in as, and the app serves
  // fixtures. Guarding it here keeps `npm run dev` on an empty .env working.
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix),
  );

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Come back to where they were trying to go, not to the dashboard.
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
     * Everything except Next's own assets and image files. Auth checks on a
     * font request cost latency and protect nothing.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)",
  ],
};
