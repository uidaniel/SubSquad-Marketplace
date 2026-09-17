"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { approveMessage, discardMessage } from "../../actions";

/**
 * Approving an AI-drafted message before it reaches a person.
 *
 * This is the rule the product rests on — nothing SubSquad writes goes out
 * without a named human agreeing to it — and all three buttons were inert.
 *
 * Editing is inline rather than on another screen. The draft is a starting
 * point, and an approver who has to leave the queue to change one sentence will
 * either send it unchanged or abandon it.
 */
export function MessageDecision({
  messageId,
  body,
}: {
  messageId: string;
  body: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [text, setText] = React.useState(body);
  const [busy, setBusy] = React.useState<"send" | "discard" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<string | null>(null);

  const edited = text.trim() !== body.trim();

  async function run(
    kind: "send" | "discard",
    work: () => Promise<{ ok: boolean; message: string }>,
  ) {
    setBusy(kind);
    setError(null);
    const result = await work();
    setBusy(null);
    if (result.ok) {
      setDone(result.message);
      router.refresh();
    } else {
      setError(result.message);
    }
  }

  if (done) {
    return (
      <p role="status" className="mt-3 text-[12.5px] font-medium text-ok">
        {done}
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-2.5">
      {editing && (
        <Textarea
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Message text"
          autoFocus
        />
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="default"
          disabled={busy !== null || !text.trim()}
          onClick={() =>
            run("send", () =>
              approveMessage(messageId, edited ? text : undefined),
            )
          }
        >
          {busy === "send" ? <Loader2 className="animate-spin" /> : <Check />}
          {edited ? "Approve edit and send" : "Approve and send"}
        </Button>

        <Button
          size="sm"
          variant="outline"
          disabled={busy !== null}
          onClick={() => setEditing((was) => !was)}
        >
          <Pencil />
          {editing ? "Done editing" : "Edit"}
        </Button>

        <Button
          size="sm"
          variant="ghost"
          disabled={busy !== null}
          onClick={() => run("discard", () => discardMessage(messageId))}
        >
          {busy === "discard" ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Trash2 />
          )}
          Discard
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-[12.5px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
