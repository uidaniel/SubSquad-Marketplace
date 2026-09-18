import { describe, expect, it } from "vitest";
import { dealClosedEmail, welcomeEmail } from "./email-templates";

/**
 * The two emails added last: a no, and a welcome. Both are pure functions, so
 * they can be checked without a mail server — for the things that matter in
 * an inbox rather than in a browser.
 */

describe("dealClosedEmail", () => {
  it("says who and what in the subject, and never mentions money", () => {
    const mail = dealClosedEmail({
      creatorFirstName: "Ada",
      brandName: "Jollof & Co",
      campaignName: "Jollof Fridays",
      reason: "declined",
      note: "Went with someone closer to Abuja.",
    });
    expect(mail.subject).toBe("Jollof & Co will not be going ahead");
    expect(mail.text).toContain("Jollof & Co has decided not to go ahead with Jollof Fridays.");
    expect(mail.text).toContain("From Jollof & Co: Went with someone closer to Abuja.");
    expect(mail.html).toContain("Went with someone closer to Abuja.");
    // No fee, no naira sign: nothing is being paid, so nothing is quoted.
    expect(mail.text).not.toMatch(/₦/);
    expect(mail.html).not.toMatch(/₦/);
    expect(mail.html).not.toContain("undefined");
  });

  it("tells a cancelled creator to stop, and omits an empty note", () => {
    const mail = dealClosedEmail({
      creatorFirstName: "Bode",
      brandName: "Zenith",
      campaignName: "Q4 Push",
      reason: "cancelled",
      note: "   ",
    });
    expect(mail.subject).toBe("Zenith has cancelled Q4 Push");
    expect(mail.text).toContain("If you had started on anything, stop");
    expect(mail.text).not.toContain("From Zenith");
    expect(mail.html).not.toContain("From Zenith");
  });
});

describe("welcomeEmail", () => {
  it("gives an agency three steps that begin with a client, and a brand three that begin with money", () => {
    const agency = welcomeEmail({
      firstName: "Ada",
      orgName: "Konga Digital",
      isAgency: true,
      dashboardUrl: "https://subsquad.ng/",
    });
    expect(agency.subject).toBe("Konga Digital is set up on SubSquad");
    expect(agency.text).toMatch(/1\. Add a client/);
    expect(agency.text).toContain("https://subsquad.ng/");

    const brand = welcomeEmail({
      firstName: "Tunde",
      orgName: "Jollof & Co",
      isAgency: false,
      dashboardUrl: "https://subsquad.ng/",
    });
    expect(brand.text).toMatch(/1\. Add funds/);
    expect(brand.text).not.toContain("Add a client");
    expect(brand.html).not.toContain("undefined");
  });
});
