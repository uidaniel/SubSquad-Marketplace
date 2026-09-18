// Capture the public marketing pages as a signed-out visitor, at desktop and
// phone width, and report any horizontal overflow.
//   node scripts/shot-marketing.mjs http://localhost:3100 ./marketing-shots
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = process.argv[2] ?? "http://localhost:3100";
const OUT = process.argv[3] ?? "./marketing-shots";
mkdirSync(OUT, { recursive: true });

const ROUTES = ["/", "/for-agencies", "/for-creators", "/pricing"];
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
    const slug = route === "/" ? "home" : route.slice(1).replace(/\//g, "-");
    const file = join(OUT, `${slug}--${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    // Horizontal overflow is the one thing a screenshot will not show.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    console.log(`${name.padEnd(8)} ${route.padEnd(14)} -> ${res?.status()} ${finalUrl.replace(BASE, "")} overflow=${overflow}px  ${file}`);
  }
  await ctx.close();
}
await browser.close();
