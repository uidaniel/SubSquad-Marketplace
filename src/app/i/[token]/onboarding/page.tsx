import { notFound } from "next/navigation";
import Link from "next/link";
import { Check, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getOnboardingState } from "@/lib/data/onboarding";
import { listBanks } from "@/lib/payouts/banks";
import { formatNaira } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { PhoneStep } from "./phone-step";
import { PayoutStep } from "./payout-step";
import { ContractStep } from "./contract-step";

export const metadata = { title: "Set up your payout" };

const STEPS = [
  { key: "phone", label: "Your number" },
  { key: "payout", label: "Where to pay you" },
  { key: "contract", label: "The contract" },
] as const;

/**
 * Three steps between accepting a deal and being able to be paid for it.
 *
 * Which one shows is decided by what is already on the record, not by where the
 * person clicked from — so a creator on their second deal lands on the contract
 * with their bank details already filled in, and one who dropped off halfway
 * through the first picks up exactly where they stopped.
 */
export default async function OnboardingPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const { token } = await params;
  const state = await getOnboardingState(token);
  if (!state) notFound();

  const justFinished = (await searchParams).done === "1";
  const currentIndex = STEPS.findIndex((s) => s.key === state.step);

  if (state.step === "done" || justFinished) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-[560px] px-4 pb-24 pt-10">
        <div className="rounded-[var(--radius-lg)] border border-line bg-surface p-6 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-ok-soft">
            <PartyPopper className="size-6 text-ok" />
          </span>
          <h1 className="mt-4 text-[22px] font-semibold tracking-[-0.02em]">
            You are all set
          </h1>
          <p className="mx-auto mt-2 max-w-[38ch] text-[14px] leading-relaxed text-ink-2">
            {formatNaira(state.feeKobo)} is held for you. Post by{" "}
            {formatDate(state.deadline)}, send us the link, and you are paid
            within 7 days.
          </p>

          <div className="mt-6 space-y-2 text-left">
            {[
              "Your WhatsApp number is verified",
              state.payoutAccountName
                ? `Paying into ${state.payoutAccountName}`
                : "Payout account saved",
              "Contract accepted",
            ].map((line) => (
              <p
                key={line}
                className="flex items-center gap-2.5 rounded-[var(--radius-sm)] bg-ground px-3 py-2.5 text-[13.5px]"
              >
                <Check className="size-4 shrink-0 text-ok" />
                {line}
              </p>
            ))}
          </div>

          <Button asChild variant="brand" size="lg" block className="mt-6">
            <Link href={`/creator/deals/${state.dealId}`}>
              Open the deal
            </Link>
          </Button>
        </div>

        <p className="mt-5 text-center text-[12.5px] leading-relaxed text-ink-3">
          Everything after this happens on WhatsApp — reminders, the draft, and
          the message telling you the money has gone out.
        </p>
      </main>
    );
  }

  const banks = state.step === "payout" ? await listBanks() : [];

  return (
    <main className="mx-auto min-h-screen w-full max-w-[560px] px-4 pb-24 pt-6">
      <header className="mb-6">
        <div className="flex items-center gap-2">
          <span className="grid size-6 place-items-center rounded-[6px] bg-brand text-[11px] font-bold text-white">
            SS
          </span>
          <span className="text-[15px] font-semibold">SubSquad</span>
        </div>

        {/* Three bars rather than "Step 1 of 3" — the shape of the whole thing
            is visible at a glance, and nobody has to read to know where they are. */}
        <div className="mt-5 flex gap-1.5" aria-hidden>
          {STEPS.map((s, i) => (
            <span
              key={s.key}
              className={cn(
                "h-1 flex-1 rounded-full",
                i <= currentIndex ? "bg-brand" : "bg-line",
              )}
            />
          ))}
        </div>
        <p className="mt-2.5 text-[12.5px] text-ink-2">
          Step {currentIndex + 1} of {STEPS.length} · {STEPS[currentIndex].label}
        </p>
      </header>

      {state.step === "phone" && <PhoneStep state={state} />}
      {state.step === "payout" && <PayoutStep state={state} banks={banks} />}
      {state.step === "contract" && <ContractStep state={state} />}
    </main>
  );
}
