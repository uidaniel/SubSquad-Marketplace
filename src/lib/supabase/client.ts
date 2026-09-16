"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * The browser client.
 *
 * Only the anon key ever reaches here, and every query it makes is subject to
 * row-level security. It exists for sign-in and sign-out, which have to happen
 * in the browser so the session cookie is set on the right origin.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
