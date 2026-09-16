/**
 * Draft file formatting, shared by the browser and the server.
 *
 * Kept free of server imports so the uploader can show a size before anything
 * has been sent, using the same rules the server applies when it checks one.
 */

export const MAX_DRAFT_BYTES = 209_715_200; // 200MB, matching the storage bucket

/** "18.4 MB" — what a creator needs to know before starting an upload. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** A rough upload time, so "this will take a while" is a number, not a vibe. */
export function estimateUploadSeconds(bytes: number, mbps = 2): number {
  return Math.ceil((bytes * 8) / (mbps * 1_000_000));
}
