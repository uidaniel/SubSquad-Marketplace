import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Every screen, as a person sees it.
 *
 * The link audit proves each route exists, the button audit proves each control
 * does something, and neither can tell you a page is ugly, confusing or empty.
 * Only looking can. This captures each screen on each surface at a desktop and
 * a phone width so a review can be done against the real thing rather than
 * against memory.
 *
 *   node scripts/screenshot-all.mjs https://subsquad.netlify.app ./shots
 */

const BASE = process.argv[2] ?? "http://localhost:3100";
const OUT = process.argv[3] ?? "./shots";
mkdirSync(OUT, { recursive: true });

const EMAIL = process.env.E2E_EMAIL ?? "ada@kongadigital.ng";
const PASSWORD = process.env.E2E_PASSWORD ?? "subsquad-demo";

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "phone", width: 390, height: 844 },
];

const PUBLIC = ["/home", "/for-agencies", "/for-brands", "/for-creators", "/pricing", "/trust", "/login", "/signup", "/signup/check-email", "/legal/terms", "/legal/creator-agreement"];

const ORG = [
  "/",
  "/campaigns",
  "/campaigns/new",
  "/deals",
  "/approvals",
  "/outreach",
  "/creators",
  "/spaces",
  "/wallet",
  "/wallet/deposit",
  "/reports",
  "/settings",
  "/notifications",
  "/search?q=jollof",
  "/ops",
  "/ops/verification",
  "/ops/payouts",
  "/ops/disputes",
  "/ops/webhooks",
  "/ops/import",
];

const CREATOR = ["/creator", "/creator/wallet", "/creator/profile", "/creator/new"];

const browser = await chromium.launch();

async function shoot(page, route, label) {
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    try {
      await page.goto(`${BASE}${route}`, { waitUntil: "networkidle", timeout: 40_000 });
      await page.waitForTimeout(300);
      const file = join(OUT, `${label}--${vp.name}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(`  ${vp.name.padEnd(7)} ${route}`);
    } catch (e) {
      console.log(`  FAILED  ${route} (${vp.name}): ${String(e).slice(0, 80)}`);
    }
  }
}

const slug = (r) => r.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "home";

// ---- signed out --------------------------------------------------------
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  console.log("\nSigned out:");
  for (const r of PUBLIC) await shoot(page, r, `public-${slug(r)}`);
  await ctx.close();
}

// ---- the org app -------------------------------------------------------
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
  console.log(`\nOrg app, as ${EMAIL}:`);

  // A real campaign and a real deal, so the dense screens are covered.
  await page.goto(`${BASE}/campaigns`);
  const campaignHref = await page.locator('a[href^="/campaigns/"]').first().getAttribute("href").catch(() => null);
  const routes = [...ORG];
  if (campaignHref && /^\/campaigns\/[0-9a-f-]{36}$/.test(campaignHref)) {
    routes.push(campaignHref, `${campaignHref}?tab=content`, `${campaignHref}?tab=messages`, `${campaignHref}/shortlist`, `${campaignHref}/fund`);
  }
  await page.goto(`${BASE}/deals`);
  const dealHref = await page.locator('a[href^="/deals/"]').first().getAttribute("href").catch(() => null);
  if (dealHref) routes.push(dealHref);
  await page.goto(`${BASE}/creators`);
  const creatorHref = await page.locator('a[href^="/creators/"]').first().getAttribute("href").catch(() => null);
  if (creatorHref) routes.push(creatorHref);

  for (const r of routes) await shoot(page, r, `org-${slug(r)}`);

  console.log("\nCreator app (same session — shows what a signed-in non-creator sees):");
  for (const r of CREATOR) await shoot(page, r, `creator-${slug(r)}`);
  await ctx.close();
}

await browser.close();
console.log(`\nDone. Screens in ${OUT}`);
