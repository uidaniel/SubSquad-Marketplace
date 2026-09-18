import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/data/relations";
import { requireServiceClient } from "@/lib/supabase/service";
import { env } from "@/lib/env";
import type { Org, OrgMember } from "@/lib/domain";
import { findOrClaimCreatorRow } from "@/lib/auth/creator-link";

/**
 * Who is asking.
 *
 * Every screen resolves the acting org through here. It is wrapped in React's
 * `cache` so a page that needs the org in four places asks Postgres once per
 * request rather than four times.
 *
 * A user can belong to more than one org — an agency operator who also runs
 * their own brand. Until an org switcher exists, the earliest membership wins,
 * which is deterministic and matches what the sidebar shows.
 */

export interface Session {
  userId: string;
  email: string;
  name: string;
  org: Org;
  member: OrgMember;
}

/**
 * The signed-in user, or null.
 *
 * Supabase throws when a cookie is malformed or its signing key has rotated.
 * That is a signed-out user, not a server error — and treating it as one takes
 * down every page including the sign-in form, which is the only page somebody
 * in that state can act on.
 */
async function currentUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user;
  } catch {
    return null;
  }
}

export const getSession = cache(async (): Promise<Session | null> => {
  if (env.demoMode) return null;

  const supabase = await createClient();
  const user = await currentUser(supabase);
  if (!user) return null;

  // Read through the user's own client so RLS decides what they can see. A
  // membership row they cannot read is a membership they do not have.
  const { data: membership } = await supabase
    .from("org_members")
    .select("id, org_id, user_id, role, orgs(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  // Supabase returns an embedded relation as an array even when the foreign key
  // guarantees one row. Casting it straight to an object type checks fine and
  // yields undefined for every field — which meant org.id was undefined and
  // every org-scoped query after this silently matched nothing.
  const orgRow = one(membership?.orgs);
  if (!membership || !orgRow) return null;
  const name =
    (user.user_metadata?.name as string | undefined) ??
    user.email?.split("@")[0] ??
    "Team member";

  return {
    userId: user.id,
    email: user.email ?? "",
    name,
    member: {
      id: membership.id,
      orgId: membership.org_id,
      userId: membership.user_id,
      name,
      email: user.email ?? "",
      role: membership.role,
    },
    org: {
      id: orgRow.id as string,
      type: orgRow.type as Org["type"],
      name: orgRow.name as string,
      cacNumber: (orgRow.cac_number as string) ?? null,
      country: orgRow.country as string,
      verificationStatus: orgRow.verification_status as Org["verificationStatus"],
      verifiedAt: (orgRow.verified_at as string) ?? null,
      defaultMarginBps:
        orgRow.default_margin_bps === null
          ? null
          : Number(orgRow.default_margin_bps),
    },
  };
});

/**
 * The session, or a redirect.
 *
 * Middleware already turns away anyone without a session, so reaching here
 * without one means the user is authenticated but has no org yet — they signed
 * up and stopped halfway. They are sent to finish, not to the login page they
 * have already passed.
 */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) {
    const supabase = await createClient();
    const user = await currentUser(supabase);
    if (!user) redirect("/login");

    // A creator is a signed-in user with no org. Sending them to "tell us
    // about your company" asks somebody who makes videos for a CAC number —
    // it happened to a real creator on the day they signed up. Their surface
    // is /creator, and it can tell them apart from someone who genuinely
    // stopped halfway through agency sign-up.
    const creator = await getSessionCreator();
    redirect(creator ? "/creator" : "/signup/org");
  }
  return session;
}

/**
 * The creator behind this session, if there is one.
 *
 * Creators and org members are both `auth.users`; what separates them is which
 * table points at them. A person can be both — a creator who also runs an
 * agency — and the app decides by which surface they are on rather than by
 * giving them a role.
 */
export const getSessionCreator = cache(async () => {
  if (env.demoMode) return null;

  const supabase = await createClient();
  const user = await currentUser(supabase);
  if (!user) return null;

  // By user_id, or by claiming the unclaimed row with this email. Matching on
  // user_id alone sent a freshly signed-up creator to "about your company".
  return findOrClaimCreatorRow({ id: user.id, email: user.email });
});

/**
 * Creates an org, its first space, and the founding membership.
 *
 * All three or none: a user left with an org they are not a member of cannot
 * see it, and an org with no space cannot hold money. The service client is
 * used because at this moment the user is a member of nothing, so RLS would
 * refuse the very rows that make them a member.
 */
export async function createOrgForUser(args: {
  userId: string;
  type: "agency" | "brand";
  name: string;
  cacNumber?: string | null;
  firstSpaceName?: string;
}): Promise<{ orgId: string } | { error: string }> {
  const db = requireServiceClient();

  const { data: org, error: orgError } = await db
    .from("orgs")
    .insert({
      type: args.type,
      name: args.name.trim(),
      cac_number: args.cacNumber?.trim() || null,
      country: "NG",
      verification_status: "pending",
      default_margin_bps: args.type === "agency" ? 1500 : null,
    })
    .select("id")
    .single();

  if (orgError || !org) {
    return { error: orgError?.message ?? "Could not create the account." };
  }

  const { error: memberError } = await db.from("org_members").insert({
    org_id: org.id,
    user_id: args.userId,
    role: "owner",
  });

  if (memberError) {
    await db.from("orgs").delete().eq("id", org.id);
    return { error: memberError.message };
  }

  // A brand works out of one space, its own. An agency starts with one client
  // space they can rename, because a wallet has to belong to somebody.
  const { error: spaceError } = await db.from("spaces").insert({
    org_id: org.id,
    name: args.firstSpaceName?.trim() || args.name.trim(),
    is_self: args.type === "brand",
  });

  if (spaceError) {
    await db.from("org_members").delete().eq("org_id", org.id);
    await db.from("orgs").delete().eq("id", org.id);
    return { error: spaceError.message };
  }

  return { orgId: org.id };
}

/**
 * Whether the signed-in user works at SubSquad.
 *
 * Read through the user's own client, so the `platform_staff` policy decides:
 * a non-member cannot see the roster at all and gets nothing back. The sidebar
 * used to show "Ops console" to every agency, and every agency got a 404.
 */
export const getIsStaff = cache(async (): Promise<boolean> => {
  if (env.demoMode) return true;
  const supabase = await createClient();
  const user = await currentUser(supabase);
  if (!user) return false;
  const { data } = await supabase
    .from("platform_staff")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  return Boolean(data);
});
