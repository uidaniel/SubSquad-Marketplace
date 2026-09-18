// Capture the public marketing pages as a signed-out visitor, at desktop and
// phone width, and report any horizontal overflow.
//   node scripts/shot-marketing.mjs http://localhost:3100 ./marketing-shots
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = process.argv[2] ?? "http://localhost:3100";
const OUT = process.argv[3] ?? "./marketing-shots";
mkdirSync(OUT, { recursive: true });

const ROUTES = ["/", "/for-agencies", "/for-brands", "/for-creators", "/pricing", "/trust"];
const SIZES = [
  ["desktop", 1280, 800],
  ["phone", 390, 844],
];

const browser = await chromium.launch();
for (const [name, width, height] of SIZES) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  for (const route of ROUTES) {
    const res = await page.goto(`${BASE}${route}`, { waitUntil: "networkidle", timeout: 60_000 });
    const finalUrl = page.url();
    // Sections reveal as they are scrolled to, so walk the page before the
    // full-page capture or everything below the fold photographs blank.
    await page.evaluate(async () => {
      const step = Math.max(300, Math.floor(innerHeight * 0.6));
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
      scrollTo(0, 0);
    });
    await page.waitForTimeout(1200);
    const slug = route === "/" ? "home" : route.slice(1).replace(/\//g, "-");
    const file = join(OUT, `${slug}--${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    // Horizontal overflow is the one thing a screenshot will not show.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    console.log(`${name.padEnd(8)} ${route.padEnd(14)} -> ${res?.status()} ${finalUrl.replace(BASE, "")} overflow=${overflow}px  ${file}`);
  }

  // The moving parts, checked once on the home page at desktop width:
  // the entrance ran, sections below the fold wait to be scrolled to, and
  // the hero film moves on from its first clip.
  if (name === "desktop") {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60_000 });
    const motion = await page.evaluate(() => document.documentElement.classList.contains("motion"));
    await page.waitForTimeout(1800);
    const heroShown = await page.evaluate(() =>
      Array.from(document.querySelectorAll("[data-hero]")).every((el) => getComputedStyle(el).opacity === "1"),
    );
    const belowHidden = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll("[data-reveal]"));
      const far = els.filter((el) => el.getBoundingClientRect().top > innerHeight * 2);
      return far.length > 0 && far.every((el) => getComputedStyle(el).opacity === "0");
    });
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
    await page.waitForTimeout(1600);
    const bottomShown = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll("[data-reveal]")).slice(-3);
      return els.every((el) => getComputedStyle(el).opacity === "1");
    });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    const started = Date.now();
    let reel = "did not switch within 25s";
    for (let i = 0; i < 50; i++) {
      const state = await page.evaluate(() => {
        const vids = Array.from(document.querySelectorAll("[data-parallax] video"));
        const visible = vids.find((v) => getComputedStyle(v).opacity === "1");
        return visible ? { src: visible.dataset.src, playing: !visible.paused, t: visible.currentTime.toFixed(1) } : null;
      });
      if (state?.src && !state.src.endsWith("hero-1.mp4")) {
        reel = `switched to ${state.src.split("/").pop()} after ${((Date.now() - started) / 1000).toFixed(1)}s, playing=${state.playing}`;
        break;
      }
      await page.waitForTimeout(500);
    }
    console.log(`motion   html.motion=${motion} heroEntrance=${heroShown} belowFoldHidden=${belowHidden} revealedOnScroll=${bottomShown}`);
    console.log(`reel     ${reel}`);
  }
  await ctx.close();
}
await browser.close();
