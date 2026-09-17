import Link from "next/link";
import { CreatorTabBar } from "@/components/creator/tab-bar";

/**
 * The creator app.
 *
 * Mobile-first is not a responsive afterthought here: a creator will open this
 * on a phone, from WhatsApp, on data they are paying for. One column, a tab bar
 * where a thumb reaches, and nothing that needs a wide screen to make sense.
 */
export default function CreatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-ground/90 backdrop-blur-md">
        <div className="mx-auto flex h-13 w-full max-w-[560px] items-center gap-2 px-4 py-2.5">
          <Link href="/creator" className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-[6px] bg-brand text-[12px] font-bold text-white">
              SS
            </span>
            <span className="text-[15px] font-semibold">SubSquad</span>
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[560px] flex-1 px-4 pb-28 pt-5">
        {children}
      </div>

      <CreatorTabBar
        tabs={[
          { href: "/creator", label: "Deals", icon: "deals" },
          { href: "/creator/wallet", label: "Money", icon: "wallet" },
          { href: "/creator/new", label: "New deal", icon: "new" },
          { href: "/creator/profile", label: "Profile", icon: "profile" },
        ]}
      />
    </div>
  );
}
