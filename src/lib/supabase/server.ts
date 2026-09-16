import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

/**
 * The signed-in user's database client.
 *
 * Unlike the service client, this one carries the user's JWT, so every query it
 * makes is filtered by row-level security in Postgres. That is the point: the
 * boundary between two agencies' data is enforced by the database, not by
 * remembering to add `.eq("org_id", …)` to every query.
 *
 * Anything that legitimately needs to cross that boundary — webhooks, ledger
 * posting, background jobs — uses the service client instead, deliberately.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // The middleware refreshes the session, so this is safe to ignore.
          }
        },
      },
    },
  );
}
