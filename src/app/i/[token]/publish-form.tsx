"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { submitPublishedLink } from "./actions";

/**
 * Where a creator tells us it is live.
 *
 * The last step, and the one that releases the money. It is a single field on
 * purpose: they are on a phone, they have just pasted from another app, and
 * anything more than one box between them and being paid is one thing too many.
 */
export function PublishForm() {
  const [state, action] = useActionState(submitPublishedLink, undefined);
  const [open, setOpen] = React.useState(false);

  if (state && "ok" in state) {
    return (
      <p role="status" className="py-2 text-center text-[13px] leading-relaxed text-ok">
        Got it. We are checking the post now — your payment releases as soon as
        it checks out, and automatically in three days if nobody gets to it.
      </p>
    );
  }

  if (!open) {
    return (
      <div className="space-y-2">
        <Button variant="brand" size="lg" block onClick={() => setOpen(true)}>
          <ExternalLink /> Post it, then paste the link
        </Button>
        <p className="text-center text-[12.5px] leading-relaxed text-ink-2">
          Payment releases once we can see it is live.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <TokenField />
      <Field
        label="Link to your post"
        htmlFor="published-url"
        error={state && "error" in state ? state.error : undefined}
      >
        <Input
          id="published-url"
          name="url"
          inputMode="url"
          autoFocus
          placeholder="https://www.tiktok.com/@you/video/..."
        />
      </Field>
      <div className="flex gap-2">
        <Submit />
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** The token comes from the URL, so the form does not have to be told it. */
function TokenField() {
  const [token, setToken] = React.useState("");
  React.useEffect(() => {
    const parts = window.location.pathname.split("/").filter(Boolean);
    setToken(parts[1] ?? "");
  }, []);
  return <input type="hidden" name="token" value={token} />;
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="brand" block disabled={pending}>
      {pending && <Loader2 className="animate-spin" />}
      That is my post
    </Button>
  );
}
