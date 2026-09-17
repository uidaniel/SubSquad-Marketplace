import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireServiceClient } from "@/lib/supabase/service";
import { getSession } from "@/lib/auth/session";
import { one } from "@/lib/data/relations";

export const metadata = { title: "Join an account" };
export const dynamic = "force-dynamic";

/**
 * Accepting an invitation into an agency account.
 *
 * Three ways this can go, and each needs a different screen rather than a
 * generic error: the invite is bad or stale, the visitor is not signed in, or
 * the visitor is signed in as somebody the invite was not for.
 *
 * The last one matters most. An invite is addressed to one email; if it is
 * forwarded, or opened on a shared laptop, accepting it must not quietly attach
 * the wrong account to a company's money.
 */
export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = requireServiceClient();

  const { data: invite } = await db
    .from("org_invites")
    .select("id, org_id, email, role, accepted_at, expires_at, orgs(name)")
    .eq("token", token)
    .maybeSingle();

  // Supabase types an embedded relation as an array even where the foreign key
  // guarantees one row.
  const orgName = one(invite?.orgs)?.name as string | undefined;

  if (!invite) {
    return (
      <Shell
        tone="bad"
        title="This invitation is not valid"
        body="The link may have been withdrawn, or already used. Ask whoever invited you to send a new one."
      />
    );
  }

  if (invite.accepted_at) {
    return (
      <Shell
        tone="bad"
        title="This invitation has already been used"
        body={`If that was you, sign in and you will find ${orgName ?? "the account"} waiting.`}
        action={{ href: "/login", label: "Sign in" }}
      />
    );
  }

  if (new Date(invite.expires_at) < new Date()) {
    return (
      <Shell
        tone="bad"
        title="This invitation has expired"
        body="Invitations last seven days. Ask for a new one — it takes them a moment."
      />
    );
  }

  const session = await getSession();

  if (!session) {
    // Signing up carries the token through, so the invite is accepted the
    // moment the account exists rather than being lost at the door.
    return (
      <Shell
        tone="good"
        title={`Join ${orgName ?? "this account"} on SubSquad`}
        body={`You have been invited as ${invite.role === "admin" ? "an admin" : "a member"}, at ${invite.email}. Sign in or create your account with that address to accept.`}
        action={{
          href: `/signup?invite=${token}&email=${encodeURIComponent(invite.email)}`,
          label: "Create your account",
        }}
        secondary={{
          href: `/login?next=${encodeURIComponent(`/join/${token}`)}`,
          label: "I already have one",
        }}
      />
    );
  }

  if (session.email.toLowerCase() !== invite.email.toLowerCase()) {
    return (
      <Shell
        tone="bad"
        title="This invitation is for a different address"
        body={`It was sent to ${invite.email}, and you are signed in as ${session.email}. Sign out and back in with the invited address, or ask for an invitation to this one.`}
        action={{ href: "/login", label: "Sign in as someone else" }}
      />
    );
  }

  // Everything checks out. Join, mark it used, and go.
  await db.from("org_members").insert({
    org_id: invite.org_id,
    user_id: session.userId,
    role: invite.role,
  });

  await db
    .from("org_invites")
    .update({ accepted_at: new Date().toISOString(), accepted_by: session.userId })
    .eq("id", invite.id);

  redirect("/");
}

function Shell({
  tone,
  title,
  body,
  action,
  secondary,
}: {
  tone: "good" | "bad";
  title: string;
  body: string;
  action?: { href: string; label: string };
  secondary?: { href: string; label: string };
}) {
  const Icon = tone === "good" ? Check : AlertTriangle;
  return (
    <main className="mx-auto flex min-h-screen max-w-[28rem] flex-col justify-center px-5 py-12">
      <span
        className={`grid size-11 place-items-center rounded-full ${
          tone === "good" ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn"
        }`}
      >
        <Icon className="size-5" />
      </span>
      <h1 className="mt-4 text-[22px] font-semibold leading-tight tracking-[-0.02em]">
        {title}
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{body}</p>

      {action && (
        <Button className="mt-5" asChild>
          <Link href={action.href}>{action.label}</Link>
        </Button>
      )}
      {secondary && (
        <Button variant="ghost" className="mt-2" asChild>
          <Link href={secondary.href}>{secondary.label}</Link>
        </Button>
      )}
    </main>
  );
}
