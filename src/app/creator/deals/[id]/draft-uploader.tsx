"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Film, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { formatBytes } from "@/lib/drafts/format";
import { startDraftUpload, submitDraft } from "./draft-actions";

type Phase =
  | { kind: "idle" }
  | { kind: "uploading"; percent: number }
  | { kind: "saving" }
  | { kind: "error"; message: string };

/**
 * Sending a draft in.
 *
 * Written for the worst case this product actually has: a sixty-second 1080p
 * video, on a mid-range Android, on Nigerian mobile data. So the file goes
 * straight from the phone to Storage rather than through our server, the
 * percentage is real rather than a spinner, and a failure keeps the chosen file
 * so retrying is one tap instead of finding the video again.
 */
export function DraftUploader({
  dealId,
  buttonLabel,
}: {
  dealId: string;
  buttonLabel: string;
}) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [caption, setCaption] = React.useState("");
  const [phase, setPhase] = React.useState<Phase>({ kind: "idle" });

  const busy = phase.kind === "uploading" || phase.kind === "saving";

  async function send() {
    if (!file) return;
    setPhase({ kind: "uploading", percent: 0 });

    const ticket = await startDraftUpload({
      dealId,
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    });

    if ("error" in ticket) {
      setPhase({ kind: "error", message: ticket.error });
      return;
    }

    try {
      // supabase-js does not surface upload progress, and a silent three-minute
      // wait on a phone reads as a hang. XHR does, so the bar is honest.
      await uploadWithProgress({
        bucketUrl: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/upload/sign/drafts/${ticket.path}?token=${ticket.token}`,
        file,
        onProgress: (percent) => setPhase({ kind: "uploading", percent }),
      });

      setPhase({ kind: "saving" });
      const saved = await submitDraft({
        dealId,
        path: ticket.path,
        version: ticket.version,
        caption,
      });

      if ("error" in saved) {
        setPhase({ kind: "error", message: saved.error });
        return;
      }

      setFile(null);
      setCaption("");
      setPhase({ kind: "idle" });
      router.refresh();
    } catch (error) {
      setPhase({
        kind: "error",
        message:
          (error as Error).message ||
          "The upload stopped. Check your connection and try again — your file is still here.",
      });
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="video/*,image/*"
        className="sr-only"
        onChange={(e) => {
          const chosen = e.target.files?.[0] ?? null;
          setFile(chosen);
          setPhase({ kind: "idle" });
        }}
      />

      {!file ? (
        <Button
          variant="brand"
          size="lg"
          block
          onClick={() => inputRef.current?.click()}
        >
          <Upload />
          {buttonLabel}
        </Button>
      ) : (
        <>
          <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-line bg-surface p-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-[8px] bg-ground">
              <Film className="size-5 text-ink-2" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-medium">
                {file.name}
              </span>
              <span className="block text-[12.5px] text-ink-3">
                {formatBytes(file.size)}
              </span>
            </span>
            {!busy && (
              <button
                type="button"
                aria-label="Choose a different file"
                onClick={() => {
                  setFile(null);
                  setPhase({ kind: "idle" });
                }}
                className="grid size-8 place-items-center rounded-full text-ink-3 hover:bg-ground hover:text-ink"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          <Field
            label="Caption"
            hint="Keep #Ad on the first line — that is ARCON law, and we check it."
            htmlFor="caption"
          >
            <textarea
              id="caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              disabled={busy}
              rows={3}
              placeholder="#Ad Wetin dey worry us about transfer fees?…"
              className="w-full rounded-[var(--radius-sm)] border border-line-strong bg-surface p-3 text-[15px] outline-none focus-visible:border-ink disabled:opacity-60"
            />
          </Field>

          {phase.kind === "uploading" && (
            <div>
              <div className="h-1.5 overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-brand transition-[width] duration-200"
                  style={{ width: `${phase.percent}%` }}
                />
              </div>
              <p className="mt-2 text-[12.5px] text-ink-2">
                Uploading — {phase.percent}%. Keep this page open.
              </p>
            </div>
          )}

          {phase.kind === "error" && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-[var(--radius-sm)] bg-danger-soft px-3 py-2.5 text-[13px] text-danger"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {phase.message}
            </p>
          )}

          <Button variant="brand" size="lg" block disabled={busy} onClick={send}>
            {busy && <Loader2 className="animate-spin" />}
            {phase.kind === "saving"
              ? "Almost there…"
              : phase.kind === "error"
                ? "Try again"
                : "Send my draft"}
          </Button>

          <p className="text-center text-[12px] text-ink-3">
            We check it against the brief first. The brand does not see it until
            it passes.
          </p>
        </>
      )}
    </div>
  );
}

/** PUT with a progress event, which `fetch` still cannot do for uploads. */
function uploadWithProgress(args: {
  bucketUrl: string;
  file: File;
  onProgress: (percent: number) => void;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", args.bucketUrl, true);
    xhr.setRequestHeader("Content-Type", args.file.type);
    xhr.setRequestHeader("x-upsert", "false");

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        args.onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status}). Try again.`));
    });
    xhr.addEventListener("error", () =>
      reject(new Error("The connection dropped during the upload.")),
    );
    xhr.addEventListener("abort", () =>
      reject(new Error("The upload was cancelled.")),
    );

    xhr.send(args.file);
  });
}
