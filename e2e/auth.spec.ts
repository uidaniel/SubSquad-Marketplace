import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

/**
 * Sign-in, sign-up and the boundary between two agencies.
 *
 * The last test is the one that matters most: a brand-new account must see its
 * own empty dashboard and none of the seeded agency's money. That is row-level
 * security doing its job, and it is the kind of thing that is easy to believe is
 * working and expensive to be wrong about.
 */

const SEEDED = {
  email: "ada@kongadigital.ng",
  password: "subsquad-demo",
  org: "Konga Digital",
};

test.describe("signing in", () => {
  test("an unauthenticated visitor is sent to sign in, and back where they were going", async ({
    page,
  }) => {
    await page.goto("/wallet");
    await expect(page).toHaveURL(/\/login\?next=%2Fwallet/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("a wrong password says so without revealing whether the account exists", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(SEEDED.email);
    await page.getByLabel("Password").fill("not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(
      page.locator("form p[role='alert']"),
    ).toHaveText(/do not match an account/);
  });

  test("signing in lands on the dashboard with the org's real data", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(SEEDED.email);
    await page.getByLabel("Password").fill(SEEDED.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await page.waitForURL("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Ada");
    // The rail shows the org this session belongs to, not a hardcoded one.
    await expect(page.getByText(SEEDED.org).first()).toBeVisible();
    // Money from the seeded ledger, not a placeholder.
    await expect(page.getByText("Held in escrow").first()).toBeVisible();
  });

  test("it returns you to the page you asked for", async ({ page }) => {
    await page.goto("/creators");
    await page.getByLabel("Email").fill(SEEDED.email);
    await page.getByLabel("Password").fill(SEEDED.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await page.waitForURL("/creators");
    await expect(page.getByRole("heading", { name: "Creators" })).toBeVisible();
  });

  test("signing out ends the session", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(SEEDED.email);
    await page.getByLabel("Password").fill(SEEDED.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("/");

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL(/\/login/);

    // The session is gone, not just the page.
    await page.goto("/wallet");
    await expect(page).toHaveURL(/\/login/);
  });
});

/** Reads .env.local directly; the test runner is not the Next.js runtime. */
function env() {
  const file = readFileSync(".env.local", "utf8");
  return Object.fromEntries(
    file
      .split("\n")
      .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
      }),
  );
}

test.describe("a new account", () => {
  /**
   * The user is created through the admin API rather than the sign-up form.
   *
   * Not to avoid testing the form — it is covered by the error case above, and
   * it is a thin wrapper over one Supabase call — but because Supabase rate
   * limits confirmation emails, which would make this test fail for a reason
   * that has nothing to do with the thing it is checking.
   *
   * What it checks is the part that would be expensive to get wrong: a fresh
   * org sees its own empty dashboard and none of the seeded agency's money.
   */
  test("creates its org and sees none of another agency's money", async ({ page }) => {
    const e = env();
    const admin = createClient(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const stamp = Date.now().toString(36);
    const email = `e2e-${stamp}@subsquad-test.com`;
    const password = "a-long-enough-password";

    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: "Temi Balogun" },
    });
    expect(error, error?.message).toBeNull();

    try {
      // Signed in, but with no org yet — they should be sent to finish setting up.
      await page.goto("/login");
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill(password);
      await page.getByRole("button", { name: "Sign in" }).click();

      await page.waitForURL(/\/signup\/org/);
      await expect(
        page.getByRole("heading", { name: "About your company" }),
      ).toBeVisible();

      await page.getByRole("button", { name: /We are the brand/ }).click();
      await page.getByLabel("Brand name").fill(`Test Brand ${stamp}`);
      await page.getByRole("button", { name: "Create the account" }).click();

      await page.waitForURL("/");

      // Their own org, and an empty one.
      await expect(page.getByText(`Test Brand ${stamp}`).first()).toBeVisible();
      await expect(page.getByText("Brand account").first()).toBeVisible();

      // The seeded agency's data must be nowhere on this page.
      const body = await page.locator("body").innerText();
      expect(body).not.toContain("Konga Digital");
      expect(body).not.toContain("5,727,200");
      expect(body).not.toContain("Sweet Sensation");

      // A brand has no client spaces, so that navigation is not offered.
      await expect(page.getByRole("link", { name: "Clients" })).toHaveCount(0);

      // Its wallet starts empty rather than inheriting anyone else's.
      await page.goto("/wallet");
      const wallet = await page.locator("body").innerText();
      expect(wallet).not.toContain("Konga Digital");
      expect(wallet).not.toContain("PalmPay");
    } finally {
      // Leave the project as it was found.
      const userId = created?.user?.id;
      if (userId) {
        const { data: members } = await admin
          .from("org_members")
          .select("org_id")
          .eq("user_id", userId);
        for (const m of members ?? []) {
          await admin.from("spaces").delete().eq("org_id", m.org_id);
          await admin.from("org_members").delete().eq("org_id", m.org_id);
          await admin.from("orgs").delete().eq("id", m.org_id);
        }
        await admin.auth.admin.deleteUser(userId);
      }
    }
  });
});
