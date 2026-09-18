import "server-only";

import { requireServiceClient } from "@/lib/supabase/service";

/**
 * The creator row behind a signed-in user — found, or claimed.
 *
 * Creators are seeded from a shortlist long before they have an account, so
 * their row carries an email and no user_id. When they later sign up through
 * an invite, nothing links the two by itself; the link was only made when the
 * creator app happened to load. A creator who instead landed on "/" was
 * judged "not a creator" by user_id alone and sent to "tell us about your
 * company" — which happened to a real creator, twice.
 *
 * So the one lookup both gates use: by user_id first, and failing that by an
 * unclaimed row with the same email, which is claimed on the spot. The
 * service client is used because the person cannot yet read or write a row
 * that does not point at them.
 */
export async function findOrClaimCreatorRow(user: {
  id: string;
  email?: string | null;
}): Promise<Record<string, unknown> | null> {
  const db = requireServiceClient();

  const { data: linked } = await db
    .from("creators")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (linked) return linked;

  if (!user.email) return null;

  const { data: unclaimed } = await db
    .from("creators")
    .select("*")
    .ilike("email", user.email)
    .is("user_id", null)
    .limit(1)
    .maybeSingle();
  if (!unclaimed) return null;

  // Guarded on user_id still being null, so two requests racing to claim the
  // same row cannot both win.
  const { data: claimed } = await db
    .from("creators")
    .update({ user_id: user.id })
    .eq("id", unclaimed.id)
    .is("user_id", null)
    .select("*")
    .maybeSingle();

  return claimed ?? { ...unclaimed, user_id: user.id };
}
