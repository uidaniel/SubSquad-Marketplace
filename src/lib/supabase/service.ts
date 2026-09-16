import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * The service-role client.
 *
 * This bypasses row-level security, so it exists for exactly three jobs:
 * posting balanced ledger transactions, handling provider webhooks, and running
 * background work that has no user session. It must never be imported into a
 * client component, and `server-only` above makes that a build error rather
 * than a code-review question.
 */

let cached: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient | null {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  cached ??= createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return cached;
}

/** Throws rather than returning null, for paths that cannot proceed without it. */
export function requireServiceClient(): SupabaseClient {
  const client = getServiceClient();
  if (!client) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured — this operation writes to the ledger and cannot run without it.",
    );
  }
  return client;
}
