import "server-only";

import { cache } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

/**
 * Staff access to the ops console.
 *
 * Deliberately separate from org roles. An agency owner owns *their* account; a
 * SubSquad ops person operates the platform and can see across all of them.
 * Treating those as points on one scale is how an agency ends up able to read a
 * competitor's campaigns.
 */

export type StaffRole = "ops" | "admin";

export interface Staff {
  userId: string;
  role: StaffRole;
}

export const getStaff = cache(async (): Promise<Staff | null> => {
  // In demo mode there is no ops team and no real data to protect — the console
  // is browsable so the flows can be reviewed.
  if (env.demoMode) return { userId: "demo", role: "admin" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("platform_staff")
    .select("user_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  return data ? { userId: data.user_id, role: data.role as StaffRole } : null;
});

/**
 * The staff member, or a 404.
 *
 * Not a 403: a 403 confirms the console is there. Someone who is not staff has
 * no business learning that `/ops` exists, so to them it does not.
 */
export async function requireStaff(): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) notFound();
  return staff;
}

/** Actions that change money or revoke access are admin-only. */
export async function requireStaffAdmin(): Promise<Staff> {
  const staff = await requireStaff();
  if (staff.role !== "admin") notFound();
  return staff;
}
