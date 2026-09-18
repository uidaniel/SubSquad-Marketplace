import { chromium } from "playwright";

/**
 * What actually breaks at awkward widths.
 *
 * The existing spec asserts one thing — that no page scrolls sideways — at
 * three widths. That misses everything between a phone and a tablet, which is
 * exactly where a half-width desktop window lands, and it cannot see a page
 * that fits perfectly while being unreadable: a heading on four lines, a stat
 * grid squeezed to 70px a column, an action row wrapped under its own title.
 *
 * This measures those. Run it against a deployment:
 *
 *   node scripts/audit-responsive.mjs https://subsquad.netlify.app
 */

const BASE = process.argv[2] ?? "http://localhost:3100";
const EMAIL = process.env.E2E_EMAIL ?? "ada@kongadigital.ng";
const PASSWORD = process.env.E2E_PASSWORD ?? "subsquad-demo";

// The band between 430 and 900 is where a desktop window gets dragged narrow
// and where nothing was ever checked.
const WIDTHS = [360, 390, 430, 560, 620, 768, 900, 1024, 1280];

const ROUTES = [
  "/home",
  "/for-agencies",
  "/for-creators",
  "/pricing",
  "/",
  "/campaigns",
  "/deals",
  "/creators",
  "/wallet",
  "/wallet/deposit",
  "/outreach",
  "/approvals",
  "/spaces",
  "/reports",
  "/settings",
  "/campaigns/new",
];

/** Everything wrong on the page as rendered, measured in the browser. */
async function audit(page, width) {
  return page.evaluate((viewportWidth) => {
    const findings = [];
    const doc = document.documentElement;

    const overflow = doc.scrollWidth - doc.clientWidth;
    if (overflow > 1) {
      const wide = [...document.querySelectorAll("*")]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.right > doc.clientWidth + 1;
        })
        .slice(0, 3)
        .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}`);
      findings.push(`scrolls sideways by ${overflow}px (${wide.join(", ")})`);
    }

    // A heading broken over many lines is the clearest sign of a squeeze.
    const h1 = document.querySelector("h1");
    if (h1) {
      const style = getComputedStyle(h1);
      const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
      const lines = Math.round(h1.getBoundingClientRect().height / lineHeight);
      if (lines >= 3) findings.push(`page title wraps onto ${lines} lines`);
    }

    // Columns too narrow to read.
    //
    // Judged on the widest column, not the narrowest: a row of
    // [1fr 90px 140px auto] has a 36px column on purpose — it holds a button —
    // and flagging that called a correct layout broken. A row where even the
    // widest column cannot hold a few words is the real problem.
    for (const grid of document.querySelectorAll("dl, .grid")) {
      const cols = getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean);
      if (cols.length < 2) continue;
      const widths = cols.map((c) => parseFloat(c)).filter((n) => !isNaN(n));
      if (widths.length === 0) continue;
      const widest = Math.max(...widths);
      if (widest < 110 && grid.textContent && grid.textContent.trim().length > 40) {
        findings.push(
          `a ${cols.length}-column grid of text is only ${Math.round(widest)}px at its widest`,
        );
        break;
      }
    }

    // Anything a finger has to hit.
    const small = [...document.querySelectorAll("button, a[href], [role=button]")].filter(
      (el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0 || r.height >= 36) return false;

        // A link inside a sentence is not a tap target — it is a word. Padding
        // it to 36px would break the line it sits in. Only standalone controls
        // are held to the thumb-sized floor, so this skips any link whose
        // parent is mostly other text.
        const own = (el.textContent ?? "").trim().length;
        const parent = (el.parentElement?.textContent ?? "").trim().length;
        const inlineInProse = parent > own * 2 && parent - own > 30;
        return !inlineInProse;
      },
    );
    if (viewportWidth < 768 && small.length > 0) {
      // Naming them matters. "8 tap targets under 36px" is a number to worry
      // about; "the client card links are 28px" is something to fix.
      const named = small
        .slice(0, 4)
        .map((el) => {
          const label = (el.textContent ?? "").trim().slice(0, 24) || el.tagName.toLowerCase();
          return `${label} (${Math.round(el.getBoundingClientRect().height)}px)`;
        })
        .join(", ");
      findings.push(`${small.length} tap targets under 36px: ${named}`);
    }

    // Text nobody can read on a phone.
    const tiny = [...document.querySelectorAll("p, span, td, li, dd, dt")].filter((el) => {
      if (!el.textContent?.trim()) return false;
      return parseFloat(getComputedStyle(el).fontSize) < 12;
    });
    if (tiny.length > 0) findings.push(`${tiny.length} elements with text under 12px`);

    return findings;
  }, width);
}

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

await page.goto(`${BASE}/login`);
await page.getByLabel("Email").fill(EMAIL);
await page.getByLabel("Password").fill(PASSWORD);
await page.getByRole("button", { name: /sign in/i }).click();
await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
console.log(`Signed in as ${EMAIL}\n`);

// A real campaign, so the detail and shortlist screens are covered too — the
// ones with the densest layouts and the ones never tested.
const href = await page
  .locator('a[href^="/campaigns/"]')
  .first()
  .getAttribute("href")
  .catch(() => null);
const routes = [...ROUTES];
if (href && /^\/campaigns\/[0-9a-f-]{36}$/.test(href)) {
  routes.push(href, `${href}/shortlist`, `${href}/fund`);
}

const problems = new Map();

for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: 900 });
  for (const route of routes) {
    try {
      await page.goto(`${BASE}${route}`, { waitUntil: "networkidle", timeout: 30_000 });
      const findings = await audit(page, width);
      for (const f of findings) {
        const key = `${route} :: ${f.replace(/\d+/g, "N")}`;
        if (!problems.has(key)) problems.set(key, { route, finding: f, widths: [] });
        problems.get(key).widths.push(width);
      }
    } catch {
      // A route that will not load is a different problem; the link audit covers it.
    }
  }
  process.stdout.write(`  ${width}px checked\n`);
}

console.log("\n=== RESPONSIVE PROBLEMS ===");
if (problems.size === 0) {
  console.log("  (none)");
} else {
  const byRoute = new Map();
  for (const p of problems.values()) {
    if (!byRoute.has(p.route)) byRoute.set(p.route, []);
    byRoute.get(p.route).push(p);
  }
  for (const [route, list] of byRoute) {
    console.log(`\n  ${route}`);
    for (const p of list) {
      console.log(`      ${p.finding}`);
      console.log(`        at ${p.widths.join(", ")}px`);
    }
  }
}

await browser.close();
