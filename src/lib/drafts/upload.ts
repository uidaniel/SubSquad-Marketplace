import "server-only";

import { randomBytes } from "node:crypto";
import { requireServiceClient } from "@/lib/supabase/service";

/**
 * Draft uploads.
 *
 * The file never passes through the Next server. A 200MB video relayed through
 * a serverless function would be slow, expensive, and would hit the request
 * body limit long before it finished — so the server issues a signed URL scoped
 * to one path and the phone uploads straight to Storage.
 *
 * That also means the upload survives a redeploy mid-way, which matters when
 * the connection is Nigerian mobile data and the file is sixty seconds of 1080p.
 */

export const DRAFTS_BUCKET = "drafts";
// Shared with the browser, which checks the size before starting an upload.
export { formatBytes, MAX_DRAFT_BYTES } from "./format";

export const ACCEPTED_DRAFT_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/x-m4v",
  "video/webm",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

/** Keeps the original extension so players and downloads behave. */
function extensionFor(filename: string, mimeType: string): string {
  const fromName = filename.includes(".")
    ? filename.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "")
    : "";
  if (fromName && fromName.length <= 5) return fromName;
  const fallback: Record<string, string> = {
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/x-m4v": "m4v",
    "video/webm": "webm",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  return fallback[mimeType] ?? "bin";
}

/**
 * The object path for a draft.
 *
 * The deal id leads so a storage policy can authorise on it with one path
 * segment. The random suffix stops a re-upload of the same version from
 * overwriting the previous file — version history is only history if the old
 * file is still there.
 */
export function draftObjectPath(args: {
  dealId: string;
  version: number;
  filename: string;
  mimeType: string;
}): string {
  const suffix = randomBytes(6).toString("hex");
  const ext = extensionFor(args.filename, args.mimeType);
  return `${args.dealId}/v${args.version}-${suffix}.${ext}`;
}

export interface SignedUpload {
  path: string;
  /** Paired with the path by `uploadToSignedUrl` on the client. */
  token: string;
  version: number;
}

/**
 * Issues a one-path upload ticket.
 *
 * Scoped to a single object and short-lived, so a leaked ticket can overwrite
 * nothing else and stops working quickly.
 */
export async function createDraftUpload(args: {
  dealId: string;
  version: number;
  filename: string;
  mimeType: string;
}): Promise<SignedUpload | { error: string }> {
  const db = requireServiceClient();
  const path = draftObjectPath(args);

  const { data, error } = await db.storage
    .from(DRAFTS_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    return { error: error?.message ?? "Could not start the upload." };
  }

  return { path: data.path, token: data.token, version: args.version };
}

/**
 * A temporary link to watch a draft.
 *
 * Deliberately short: long enough for an agency to review it, short enough that
 * a link pasted into a group chat stops working before it spreads.
 */
export async function signedDraftUrl(
  path: string,
  expiresInSeconds = 60 * 60,
): Promise<string | null> {
  const db = requireServiceClient();
  const { data } = await db.storage
    .from(DRAFTS_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  return data?.signedUrl ?? null;
}
