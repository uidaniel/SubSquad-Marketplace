"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { inviteTeammate } from "../actions";

/**
 * Inviting somebody into the account.
 *
 * The role is chosen here rather than afterwards, because the difference is
 * about money: an admin can approve outreach and release payments, a member can
 * see the work but cannot move anything. Saying so on the form is cheaper than
 * explaining it after somebody has paid a creator by accident.
 */
export function InviteTeammate({ canInvite }: { canInvite: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<"admin" | "member">("member");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  async function send() {
    setBusy(true);
    setResult(null);
    const outcome = await inviteTeammate(email, role);
    setBusy(false);
    setResult(outcome);
    if (outcome.ok) {
      setEmail("");
      router.refresh();
    }
  }

  if (!canInvite) return null;

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <UserPlus /> Invite a teammate
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <div className="space-y-2">
            <DialogTitle>Invite a teammate</DialogTitle>
            <DialogDescription>
              They get an email with a link that works once and expires in seven
              days. Nothing happens until they accept it.
            </DialogDescription>
          </div>

          <div className="space-y-4">
            <Field label="Their email" htmlFor="invite-email">
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="chinedu@agency.ng"
                autoFocus
              />
            </Field>

            <Field
              label="What they can do"
              htmlFor="invite-role"
              hint={
                role === "admin"
                  ? "Admins can approve outreach and release payments."
                  : "Members see everything but cannot move money."
              }
            >
              <Select
                id="invite-role"
                value={role}
                onChange={(e) => setRole(e.target.value as "admin" | "member")}
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </Select>
            </Field>
          </div>

          {result && (
            <p
              role={result.ok ? "status" : "alert"}
              className={`rounded-[var(--radius-sm)] px-3 py-2.5 text-[13px] leading-relaxed ${
                result.ok ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger"
              }`}
            >
              {result.message}
            </p>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{result?.ok ? "Done" : "Cancel"}</Button>
            </DialogClose>
            <Button disabled={busy || !email.trim()} onClick={send}>
              {busy ? <Loader2 className="animate-spin" /> : <UserPlus />}
              Send invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
