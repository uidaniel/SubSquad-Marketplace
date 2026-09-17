import { afterEach, describe, expect, it } from "vitest";
import { creatorUrl, surfaceForHost } from "./domains";

/**
 * The invite link is the single most important URL in the product: it is what
 * a creator taps in an email from a company they have never heard of. It went
 * out for a while as `/creator/i/<token>` and 404'd, because `creatorUrl`
 * prefixed every path with `/creator` while the route lives at the app root and
 * middleware deliberately exempts it.
 */

const ORIGINAL = { ...process.env };
afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("creatorUrl", () => {
  describe("without a root domain (preview and localhost)", () => {
    it("leaves invite links at the app root", () => {
      process.env.NEXT_PUBLIC_APP_URL = "https://subsquad.netlify.app";
      delete process.env.NEXT_PUBLIC_ROOT_DOMAIN;

      expect(creatorUrl("/i/abc123")).toBe(
        "https://subsquad.netlify.app/i/abc123",
      );
    });

    it("leaves guest payment and payment-return links at the app root", () => {
      process.env.NEXT_PUBLIC_APP_URL = "https://subsquad.netlify.app";
      delete process.env.NEXT_PUBLIC_ROOT_DOMAIN;

      expect(creatorUrl("/d/tok")).toBe("https://subsquad.netlify.app/d/tok");
      expect(creatorUrl("/payments/complete")).toBe(
        "https://subsquad.netlify.app/payments/complete",
      );
    });

    it("still prefixes the creator app's own pages", () => {
      process.env.NEXT_PUBLIC_APP_URL = "https://subsquad.netlify.app";
      delete process.env.NEXT_PUBLIC_ROOT_DOMAIN;

      expect(creatorUrl("/wallet")).toBe(
        "https://subsquad.netlify.app/creator/wallet",
      );
      expect(creatorUrl("/")).toBe("https://subsquad.netlify.app/creator");
    });
  });

  describe("with a root domain", () => {
    it("puts every creator path on the subdomain, with no prefix", () => {
      process.env.NEXT_PUBLIC_APP_URL = "https://subsquad.ng";
      process.env.NEXT_PUBLIC_ROOT_DOMAIN = "subsquad.ng";

      expect(creatorUrl("/i/abc123")).toBe("https://creator.subsquad.ng/i/abc123");
      expect(creatorUrl("/wallet")).toBe("https://creator.subsquad.ng/wallet");
    });
  });
});

describe("surfaceForHost", () => {
  it("reads the creator subdomain regardless of case or port", () => {
    expect(surfaceForHost("creator.subsquad.ng")).toBe("creator");
    expect(surfaceForHost("Creator.subsquad.ng:3000")).toBe("creator");
  });

  it("treats everything else as the org app", () => {
    expect(surfaceForHost("subsquad.ng")).toBe("org");
    expect(surfaceForHost("subsquad.netlify.app")).toBe("org");
    expect(surfaceForHost(null)).toBe("org");
  });
});
