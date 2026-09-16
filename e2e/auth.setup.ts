import { expect, test as setup } from "@playwright/test";
import path from "node:path";

/**
 * Signs in once and saves the session for every other spec to reuse.
 *
 * Without this, the suites that check the app's screens would quietly be
 * checking the login page instead — they would still pass, and they would be
 * testing nothing.
 */

export const ORG_STATE = path.join(
  process.cwd(),
  "playwright/.auth/org.json",
);

setup("sign in as the seeded agency", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("ada@kongadigital.ng");
  await page.getByLabel("Password").fill("subsquad-demo");
  await page.getByRole("button", { name: "Sign in" }).click();

  await page.waitForURL("/");
  // Prove the session is real before saving it, so a broken login surfaces here
  // rather than as a confusing failure in every downstream spec.
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Ada");

  await page.context().storageState({ path: ORG_STATE });
});
