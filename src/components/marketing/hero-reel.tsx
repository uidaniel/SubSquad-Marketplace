"use client";

import { useEffect, useRef } from "react";

/**
 * The film behind the hero: several clips, each fading into the next.
 *
 * Two <video> layers alternate. While one plays, the next clip is loaded
 * into the other a few seconds before it is needed, then faded in over the
 * top just before the first ends — so there is never a black frame, a seam,
 * or the same fourteen seconds looping for as long as somebody reads.
 *
 * Nothing plays for a person who has asked for reduced motion or turned on
 * data saving; they get the poster. If a clip fails to load, the one that
 * is playing simply loops until the next one succeeds.
 */
export function HeroReel({ clips, poster }: { clips: readonly string[]; poster: string }) {
  const first = useRef<HTMLVideoElement>(null);
  const second = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const a = first.current;
    const b = second.current;
    if (!a || !b || clips.length === 0) return;
    const layers = [a, b] as const;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (reduce || connection?.saveData) return;

    const PRELOAD_AT = 6; // seconds before the end, start fetching the next clip
    const SWITCH_AT = 1.4; // seconds before the end, start the crossfade
    const FADE_MS = 1100;

    let active = 0;
    let index = 0;
    let switching = false;
    let disposed = false;

    const show = (layer: HTMLVideoElement, on: boolean) => {
      layer.style.opacity = on ? "1" : "0";
    };

    const load = (layer: HTMLVideoElement, src: string) => {
      if (layer.dataset.src === src) return;
      layer.dataset.src = src;
      layer.src = src;
      layer.load();
    };

    const single = clips.length === 1;
    layers[0].loop = single;
    load(layers[0], clips[0]);
    show(layers[0], true);
    layers[0].play().catch(() => {});

    // A clip that reaches its end before the next was ready loops rather
    // than freezes; the switch happens on the next pass.
    const onEnded = (event: Event) => {
      const layer = event.currentTarget as HTMLVideoElement;
      if (layer === layers[active]) {
        layer.currentTime = 0;
        layer.play().catch(() => {});
      }
    };
    layers.forEach((l) => l?.addEventListener("ended", onEnded));

    const tick = () => {
      if (disposed || single) return;
      const current = layers[active];
      const next = layers[1 - active];
      if (!Number.isFinite(current.duration) || current.duration === 0) return;
      const remaining = current.duration - current.currentTime;
      const nextIndex = (index + 1) % clips.length;

      if (remaining <= PRELOAD_AT) load(next, clips[nextIndex]);

      if (remaining <= SWITCH_AT && !switching) {
        switching = true;
        next.currentTime = 0;
        next
          .play()
          .then(() => {
            if (disposed) return;
            show(next, true);
            show(current, false);
            window.setTimeout(() => {
              if (disposed) return;
              current.pause();
              active = 1 - active;
              index = nextIndex;
              switching = false;
            }, FADE_MS);
          })
          .catch(() => {
            // Could not start the next one; let the current loop and retry
            // on its next pass.
            switching = false;
          });
      }
    };

    const timer = window.setInterval(tick, 200);

    return () => {
      disposed = true;
      window.clearInterval(timer);
      layers.forEach((l) => {
        l?.removeEventListener("ended", onEnded);
        l?.pause();
      });
    };
  }, [clips]);

  const layerClass =
    "absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-[1100ms] ease-[cubic-bezier(.2,0,0,1)]";

  return (
    <div data-parallax aria-hidden className="absolute inset-0 -z-20 h-[118%] w-full">
      {/* The poster sits underneath, so the first paint and the reduced-motion
          case both show a frame of the film rather than ink. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <video ref={first} className={layerClass} muted playsInline preload="auto" disablePictureInPicture />
      <video ref={second} className={layerClass} muted playsInline preload="none" disablePictureInPicture />
    </div>
  );
}
