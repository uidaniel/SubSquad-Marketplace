"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Every animation on the public site, driven by data attributes.
 *
 * The pages are server components, so they cannot hold a timeline. Instead
 * they mark what should move — `data-hero` for the entrance, `data-reveal`
 * for anything that fades up as it arrives, `data-reveal-group` to stagger a
 * grid's children, `data-count` for a figure that counts up, `data-meter` and
 * `data-ring` for the score bars — and this one component, mounted once in
 * the layout, finds them and animates them. It re-runs on every navigation.
 *
 * The initial hidden state comes from CSS, keyed off an `html.motion` class
 * that an inline script sets before first paint, so nothing flashes and
 * nothing is hidden for a person who has asked for reduced motion or has no
 * JavaScript. If anything in here throws, the class is removed and the page
 * is simply still.
 */
export function Motion() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    if (!root.classList.contains("motion")) return;

    let ctx: gsap.Context | undefined;
    try {
      ctx = gsap.context(() => {
        const ease = "power3.out";

        /* The hero, in reading order. */
        const hero = gsap.utils.toArray<HTMLElement>("[data-hero]");
        if (hero.length) {
          gsap.fromTo(
            hero,
            { opacity: 0, y: 26 },
            { opacity: 1, y: 0, duration: 1.1, ease, stagger: 0.09, delay: 0.15, clearProps: "transform" },
          );
        }

        /* The hero video drifts a little slower than the page. */
        const video = document.querySelector<HTMLElement>("[data-parallax]");
        if (video?.parentElement) {
          gsap.to(video, {
            yPercent: 16,
            ease: "none",
            scrollTrigger: { trigger: video.parentElement, start: "top top", end: "bottom top", scrub: 0.6 },
          });
        }

        /* Anything else arrives as it enters the viewport. Once. */
        gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) => {
          gsap.fromTo(
            el,
            { opacity: 0, y: 30 },
            {
              opacity: 1, y: 0, duration: 1, ease, clearProps: "transform",
              scrollTrigger: { trigger: el, start: "top 88%", once: true },
            },
          );
        });

        gsap.utils.toArray<HTMLElement>("[data-reveal-group]").forEach((group) => {
          const kids = Array.from(group.children) as HTMLElement[];
          if (!kids.length) return;
          gsap.fromTo(
            kids,
            { opacity: 0, y: 28 },
            {
              opacity: 1, y: 0, duration: 0.9, ease, stagger: 0.08, clearProps: "transform",
              scrollTrigger: { trigger: group, start: "top 85%", once: true },
            },
          );
        });

        /* Figures count up to what they are. */
        gsap.utils.toArray<HTMLElement>("[data-count]").forEach((el) => {
          const target = Number(el.dataset.count);
          if (!Number.isFinite(target)) return;
          const prefix = el.dataset.prefix ?? "";
          const suffix = el.dataset.suffix ?? "";
          const decimals = Number(el.dataset.decimals ?? 0);
          const state = { v: 0 };
          gsap.to(state, {
            v: target, duration: 1.6, ease: "power2.out",
            scrollTrigger: { trigger: el, start: "top 85%", once: true },
            onUpdate: () => {
              el.textContent = `${prefix}${state.v.toLocaleString("en-NG", {
                minimumFractionDigits: decimals, maximumFractionDigits: decimals,
              })}${suffix}`;
            },
          });
        });

        /* Score bars and the ring fill in. */
        gsap.utils.toArray<HTMLElement>("[data-meter]").forEach((el) => {
          gsap.fromTo(
            el,
            { width: "0%" },
            { width: `${el.dataset.meter}%`, duration: 1.2, ease, scrollTrigger: { trigger: el, start: "top 92%", once: true } },
          );
        });

        gsap.utils.toArray<SVGCircleElement>("[data-ring]").forEach((el) => {
          gsap.fromTo(
            el,
            { strokeDashoffset: 226 },
            { strokeDashoffset: Number(el.dataset.ring), duration: 1.4, ease, scrollTrigger: { trigger: el, start: "top 90%", once: true } },
          );
        });
      });

      /* Fonts change line counts, and line counts change where triggers sit. */
      document.fonts?.ready.then(() => ScrollTrigger.refresh());
    } catch {
      root.classList.remove("motion");
    }

    return () => ctx?.revert();
  }, [pathname]);

  return null;
}
