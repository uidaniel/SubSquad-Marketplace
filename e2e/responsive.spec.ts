import { expect, test, type Page } from "@playwright/test";

/**
 * Responsive checks.
 *
 * These assert the one thing that is hard to eyeball and easy to break: no page
 * scrolls sideways. A screenshot cannot tell you whether a page is 20px too
 * wide — it just looks cropped — so this measures the document instead, and
 * names the widest element when it fails so the cause is obvious.
 */

const VIEWPORTS = [
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

const ORG_ROUTES = [
  "/",
  "/campaigns",
  "/wallet",
  "/wallet/deposit",
  "/creators",
  "/outreach",
  "/approvals",
  "/spaces",
  "/reports",
  "/ops",
  "/settings",
  "/campaigns/new",
];

const CREATOR_ROUTES = ["/creator", "/creator/wallet", "/creator/profile", "/creator/new"];

/** Returns the overflow in px, and the elements responsible. */
async function measureOverflow(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const overflow = doc.scrollWidth - doc.clientWidth;
    if (overflow <= 0) return { overflow, culprits: [] as string[] };

    const culprits: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
      const rect = el.getBoundingClientRect();
      if (rect.right > doc.clientWidth + 1 && rect.width > 0) {
        // Only report the element itself, not every ancestor that contains it.
        const parent = el.parentElement;
        const parentRect = parent?.getBoundingClientRect();
        if (parentRect && parentRect.right > doc.clientWidth + 1) continue;
        culprits.push(
          `<${el.tagName.toLowerCase()} class="${el.className}"> right=${Math.round(rect.right)}`,
        );
      }
      if (culprits.length >= 3) break;
    }
    return { overflow, culprits };
  });
}

for (const viewport of VIEWPORTS) {
  test.describe(`${viewport.name} (${viewport.width}px)`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const route of [...ORG_ROUTES, ...CREATOR_ROUTES]) {
      test(`${route} does not scroll sideways`, async ({ page }) => {
        await page.goto(route, { waitUntil: "domcontentloaded" });
        await page.waitForLoadState("networkidle").catch(() => {});

        const { overflow, culprits } = await measureOverflow(page);
        expect(
          overflow,
          `${route} overflows by ${overflow}px. Widest: ${culprits.join(" | ") || "unknown"}`,
        ).toBeLessThanOrEqual(0);
      });
    }

    test("the org rail is reachable", async ({ page }) => {
      await page.goto("/", { waitUntil: "domcontentloaded" });

      const nav = page.getByRole("link", { name: "Campaigns", exact: true });
      if (viewport.width >= 1024) {
        // Wide enough for the permanent rail.
        await expect(nav).toBeVisible();
      } else {
        // Below lg the rail is a drawer, so navigation must be one tap away.
        const menu = page.getByRole("button", { name: "Open navigation" });
        await expect(menu).toBeVisible();
        await menu.click();
        await expect(nav).toBeVisible();
      }
    });
  });
}
