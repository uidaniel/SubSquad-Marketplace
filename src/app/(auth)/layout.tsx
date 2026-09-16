import Link from "next/link";
import { Lock, ShieldCheck, Wallet } from "lucide-react";

/**
 * The shell around signing in.
 *
 * The left half is the form and nothing else. The right half answers the
 * question someone has before they hand over an email: what is this, and why
 * would I trust it with money. It disappears below lg, where a phone user gets
 * the form alone.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-5 py-8 sm:px-10">
        <Link href="/login" className="mb-10 inline-flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-[7px] bg-brand text-[12px] font-bold text-white">
            SS
          </span>
          <span className="text-[16px] font-semibold">SubSquad</span>
        </Link>

        <div className="flex flex-1 items-center">
          <div className="mx-auto w-full max-w-[380px]">{children}</div>
        </div>

        <p className="mt-10 text-[12px] text-ink-3">
          SubSquad Technologies Ltd · Victoria Island, Lagos
        </p>
      </div>

      <aside className="relative hidden flex-col justify-center overflow-hidden bg-chrome px-12 text-chrome-ink lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(520px 320px at 85% 8%, rgba(255,90,45,.26), transparent 70%), radial-gradient(420px 280px at 5% 100%, rgba(31,61,224,.28), transparent 70%)",
          }}
        />
        <div className="relative max-w-[420px]">
          <h2 className="text-[30px] font-semibold leading-[1.15] tracking-[-0.03em] text-white">
            Nobody is contacted until the money is already there.
          </h2>
          <p className="mt-4 text-[14.5px] leading-relaxed text-chrome-ink/70">
            Which is why creators reply to us, and why brands stop losing budget
            to no-shows.
          </p>

          <ul className="mt-9 space-y-5">
            {[
              {
                icon: Lock,
                title: "Escrow, held in naira",
                body: "Funded before outreach. Released when the post is verified live.",
              },
              {
                icon: ShieldCheck,
                title: "Every creator scored",
                body: "Bought engagement is normal here. Below the threshold never reaches your shortlist.",
              },
              {
                icon: Wallet,
                title: "Creators paid within 7 days",
                body: "To Nigerian banks, in naira. No FX risk on payout day.",
              },
            ].map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-3.5">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[9px] bg-white/[0.08]">
                  <Icon className="size-4 text-brand" />
                </span>
                <span>
                  <span className="block text-[14px] font-medium text-white">
                    {title}
                  </span>
                  <span className="block text-[13px] leading-relaxed text-chrome-ink/60">
                    {body}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
