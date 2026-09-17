"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { createSpace } from "../actions";

/**
 * Adding a client.
 *
 * Two fields, because that is genuinely all a space needs to exist — the wallet,
 * the campaigns and the reporting all follow from it. Asking for a logo and a
 * contact and a billing address before an agency can try the product is how a
 * setup screen becomes the reason somebody never starts.
 */
export function AddClient() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const result = await createSpace(name, category);
    setBusy(false);
    if (result.ok) {
      setOpen(false);
      setName("");
      setCategory("");
      router.refresh();
    } else {
      setError(result.message);
    }
  }

  return (
    <>
      <Button variant="brand" onClick={() => setOpen(true)}>
        <Plus /> Add a client
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <div className="space-y-2">
            <DialogTitle>Add a client</DialogTitle>
            <DialogDescription>
              They get their own wallet and their own campaigns. Money in one
              client&apos;s wallet can never be spent on another&apos;s work.
            </DialogDescription>
          </div>

          <div className="space-y-4">
            <Field label="Client name" htmlFor="client-name">
              <Input
                id="client-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="PalmPay"
                autoFocus
              />
            </Field>
            <Field
              label="Category"
              hint="Optional. Used to group reporting."
              htmlFor="client-category"
            >
              <Input
                id="client-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Fintech"
              />
            </Field>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-[var(--radius-sm)] bg-danger-soft px-3 py-2.5 text-[13px] text-danger"
            >
              {error}
            </p>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="brand"
              disabled={busy || !name.trim()}
              onClick={save}
            >
              {busy ? <Loader2 className="animate-spin" /> : <Plus />}
              Add client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
