import type { Metadata } from "next";
import { Figtree, Sora } from "next/font/google";
import { Motion } from "@/components/marketing/motion";
import { MarketingFooter, MarketingHeader } from "@/components/marketing/shell";
import { cn } from "@/lib/utils";

/**
 * The public site.
 *
 * Its own fonts (the Design Language's Sora and Figtree; the app keeps Geist)
 * and its own colour scope, applied by the `marketing` class in globals.css.
 * Nothing here needs a session, and nothing in the app layout is loaded.
 *
 * The inline script decides, before first paint, whether the page animates:
 * it adds `motion` to <html> unless the person has asked for reduced motion.
 * The stylesheet hides the animated elements only under that class, so a
 * page with no script is a still page, never a blank one.
 */

const sora = Sora({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-sora",
  display: "swap",
});

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-figtree",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "SubSquad — Fund it. We run it. They get paid.",
    template: "%s · SubSquad",
  },
  description:
    "Escrow-backed creator campaigns in Nigeria. The money is held before anyone is contacted, and released when the post is verified live.",
};

const MOTION_GATE =
  "try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.classList.add('motion')}catch(e){}";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        sora.variable,
        figtree.variable,
        "marketing flex min-h-screen flex-col",
      )}
    >
      <script dangerouslySetInnerHTML={{ __html: MOTION_GATE }} />
      <Motion />
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
