"use server";

import { revalidatePath } from "next/cache";
import { requireServiceClient } from "@/lib/supabase/service";
import { env } from "@/lib/env";
import {
  ACCEPTED_DRAFT_TYPES,
  createDraftUpload,
  MAX_DRAFT_BYTES,
} from "@/lib/drafts/upload";

/**
 * Submitting a draft.
 *
 * Two steps on purpose. The first hands the phone a signed ticket so the video
 * goes straight to Storage; the second records it once the bytes have landed.
 * Splitting them means a failed upload leaves no half-row claiming a file that
 * is not there.
 */

export type UploadTicket =
  | { ok: true; path: string; token: string; version: number }
  | { error: string };

/** Deal states in which new work is still wanted. */
const ACCEPTS_DRAFTS = new Set([
  "contract_signed",
  "draft_submitted",
  "revision_requested",
]);

export async function startDraftUpload(args: {
  dealId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<UploadTicket> {
  if (env.demoMode) {
    return { error: "Connect a Supabase project to upload a real draft." };
  }

  if (!ACCEPTED_DRAFT_TYPES.includes(args.mimeType as never)) {
    return { error: "Send a video (mp4 or mov) or an image." };
  }
  if (args.sizeBytes > MAX_DRAFT_BYTES) {
    return {
      error: "That file is over 200MB. Export it smaller and try again.",
    };
  }

  const db = requireServiceClient();
  const { data: deal } = await db
    .from("deals")
    .select("id, status")
    .eq("id", args.dealId)
    .maybeSingle();

  if (!deal) return { error: "We could not find that deal." };
  if (!ACCEPTS_DRAFTS.has(deal.status)) {
    return {
      error:
        deal.status === "approved" || deal.status === "published"
          ? "This draft is already approved — no need to send another."
          : "This deal is not open for drafts right now.",
    };
  }

  // Versions are per deal and count up, so the history reads the way the
  // creator experienced it: v1, then the fix, then the fix after that.
  const { data: latest } = await db
    .from("drafts")
    .select("version")
    .eq("deal_id", args.dealId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const version = (latest?.version ?? 0) + 1;

  const ticket = await createDraftUpload({
    dealId: args.dealId,
    version,
    filename: args.filename,
    mimeType: args.mimeType,
  });

  if ("error" in ticket) return { error: ticket.error };
  return { ok: true, ...ticket };
}

export type SubmitResult = { ok: true } | { error: string };

/**
 * Records a draft whose file has finished uploading.
 *
 * The deal moves to `draft_submitted` and the AI review runs next — the brand
 * does not see this yet. Nothing here decides whether the work is any good.
 */
export async function submitDraft(args: {
  dealId: string;
  path: string;
  version: number;
  caption: string;
}): Promise<SubmitResult> {
  if (env.demoMode) {
    return { error: "Connect a Supabase project to submit a real draft." };
  }

  const db = requireServiceClient();

  const { error } = await db.from("drafts").insert({
    deal_id: args.dealId,
    version: args.version,
    file_url: args.path,
    caption: args.caption.trim(),
  });

  if (error) {
    // The unique (deal_id, version) constraint catches a double submit from a
    // double tap, which on a slow connection is common rather than rare.
    return {
      error:
        error.code === "23505"
          ? "That draft is already in. Pull to refresh."
          : "We could not save that draft. Try again.",
    };
  }

  await db
    .from("deals")
    .update({ status: "draft_submitted" })
    .eq("id", args.dealId);

  revalidatePath(`/creator/deals/${args.dealId}`);
  revalidatePath(`/deals/${args.dealId}`);
  return { ok: true };
}
