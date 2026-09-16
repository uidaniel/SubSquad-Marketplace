import Link from "next/link";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { verifyTransaction } from "@/lib/payments/paystack";
import { integrations } from "@/lib/env";
import { formatNaira } from "@/lib/money";

export const metadata = { title: "Payment" };

/**
 * Where Paystack sends the browser back to.
 *
 * Deliberately cosmetic. The money moves on the webhook, which is server to
 * server, signed, and retried for three days — so somebody who closes the tab
 * the instant they pay still gets their deposit. This page exists only to tell
 * the person in front of it what happened.
 *
 * It still verifies with Paystack rather than trusting the query string, since
 * anybody can visit this URL with `?status=success` appended.
 */
export default async function PaymentCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; trxref?: string }>;
}) {
  const params = await searchParams;
  // Paystack sends both; they are the same value.
  const reference = params.reference ?? params.trxref;

  if (!reference || !integrations.paystack) {
    return (
      <Shell
        tone="unknown"
        title="We could not find that payment"
        body="If money left your account, it will still arrive — our records update from Paystack directly. Check your wallet in a few minutes."
      />
    );
  }

  let verified: Awaited<ReturnType<typeof verifyTransaction>> | null = null;
  try {
    verified = await verifyTransaction(reference);
  } catch {
    return (
      <Shell
        tone="unknown"
        title="We could not reach Paystack"
        body="This does not mean your payment failed. If it went through, it will appear in your wallet shortly."
      />
    );
  }

  if (verified.status === "success") {
    const isDeal = Boolean(verified.metadata.deal_id);
    return (
      <Shell
        tone="ok"
        title={`${formatNaira(verified.amountKobo)} received`}
        body={
          isDeal
            ? "The money is held in escrow. The creator has been told they can start, and you are not charged anything further."
            : "It is in your wallet and ready to fund a campaign."
        }
        action={
          isDeal
            ? { href: "/", label: "Done" }
            : { href: "/wallet", label: "Open your wallet" }
        }
      />
    );
  }

  if (verified.status === "abandoned" || verified.status === "failed") {
    return (
      <Shell
        tone="failed"
        title="That payment did not go through"
        body="Nothing was charged. You can try again with the same or a different card."
        action={{ href: "/wallet/deposit", label: "Try again" }}
      />
    );
  }

  return (
    <Shell
      tone="pending"
      title="Your bank is still processing this"
      body="Some transfers take a few minutes. You do not need to pay again — we will update your wallet as soon as it clears."
      action={{ href: "/wallet", label: "Open your wallet" }}
    />
  );
}

function Shell({
  tone,
  title,
  body,
  action,
}: {
  tone: "ok" | "failed" | "pending" | "unknown";
  title: string;
  body: string;
  action?: { href: string; label: string };
}) {
  const Icon =
    tone === "ok" ? CheckCircle2 : tone === "failed" ? XCircle : Clock;
  const iconClass =
    tone === "ok"
      ? "bg-ok-soft text-ok"
      : tone === "failed"
        ? "bg-danger-soft text-danger"
        : "bg-warn-soft text-warn";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[520px] items-center px-4 py-10">
      <div className="w-full rounded-[var(--radius-lg)] border border-line bg-surface p-7 text-center">
        <span className={`mx-auto grid size-12 place-items-center rounded-full ${iconClass}`}>
          <Icon className="size-6" />
        </span>
        <h1 className="mt-4 text-[21px] font-semibold tracking-[-0.02em]">
          {title}
        </h1>
        <p className="mx-auto mt-2 max-w-[40ch] text-[14px] leading-relaxed text-ink-2">
          {body}
        </p>
        {action && (
          <Button asChild variant="brand" size="lg" block className="mt-6">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        )}
      </div>
    </main>
  );
}
