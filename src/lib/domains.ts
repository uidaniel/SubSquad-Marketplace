/**
 * Which surface a request belongs to.
 *
 * The creator app lives on `creator.<domain>` rather than at `/creator`. They
 * are different audiences on different devices — an account exec on a laptop, a
 * creator on a mid-range phone — and a subdomain keeps their sessions, cookies
 * and caches genuinely separate rather than separated by a path prefix that one
 * stray link can cross.
 *
 * Underneath it is still one Next app: middleware reads the hostname and
 * rewrites, so there is one deploy, one build and one set of components.
 *
 * Until a custom domain exists, the path form still works. That is deliberate —
 * it is how the creator app gets reviewed on `localhost` and on the Netlify
 * preview URL, where subdomains are not available.
 */

export const CREATOR_SUBDOMAIN = "creator";

/**
 * Paths that belong to the creator surface wherever they are reached from.
 *
 * Invite and guest-payment links are opened by people with no account, usually
 * from WhatsApp, so they must not be trapped behind the org app's sign-in.
 */
export const SHARED_PUBLIC_PREFIXES = ["/i/", "/d/", "/payments/"];

/** The apex the subdomains hang off, e.g. "subsquad.ng". Unset while previewing. */
export function rootDomain(): string | null {
  return process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim() || null;
}

export type Surface = "org" | "creator";

/**
 * Reads the surface off a Host header.
 *
 * Port and case are stripped first: `Creator.subsquad.ng:3000` and
 * `creator.subsquad.ng` are the same host, and treating them differently is the
 * kind of bug that only shows up in one environment.
 */
export function surfaceForHost(host: string | null | undefined): Surface {
  if (!host) return "org";
  const name = host.split(":")[0].toLowerCase();
  return name === CREATOR_SUBDOMAIN || name.startsWith(`${CREATOR_SUBDOMAIN}.`)
    ? "creator"
    : "org";
}

/**
 * An absolute URL on the creator surface.
 *
 * Used for invite and deal links, which are sent to a phone and have to be
 * absolute. Falls back to the path form when no root domain is configured, so
 * links generated in preview still work.
 */
export function creatorUrl(path = "/"): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const domain = rootDomain();
  const clean = path.startsWith("/") ? path : `/${path}`;

  // Invite and payment links keep their own paths on both surfaces. They are
  // routes at the app root — `src/app/i/[token]` — and middleware deliberately
  // exempts them from the `/creator` rewrite, so prefixing them here produced
  // `/creator/i/<token>`: a 404 at the end of every invite email, on the single
  // most important link in the product.
  const isShared = SHARED_PUBLIC_PREFIXES.some((p) => clean.startsWith(p));

  if (!domain) {
    if (isShared) return `${base}${clean}`;
    return `${base}${clean === "/" ? "/creator" : `/creator${clean}`}`;
  }

  const protocol = base.startsWith("https") ? "https" : "http";
  return `${protocol}://${CREATOR_SUBDOMAIN}.${domain}${clean}`;
}

/** An absolute URL on the org app — the dashboard, wallet, ops console. */
export function orgUrl(path = "/"): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
