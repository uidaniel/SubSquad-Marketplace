import { describe, expect, it } from "vitest";
import {
  checkSendAllowed,
  chooseChannel,
  UNSOLICITED_COOLDOWN_DAYS,
  type CreatorContactState,
} from "./policy";

const NOW = new Date("2026-09-16T09:00:00.000Z");
const daysAgo = (n: number) =>
  new Date(NOW.getTime() - n * 86_400_000).toISOString();

const reachable: CreatorContactState = {
  doNotContact: false,
  lastUnsolicitedAt: null,
  phone: "+2348030000001",
  email: "creator@example.ng",
  whatsappOptIn: true,
};

describe("chooseChannel", () => {
  it("prefers WhatsApp, which is where creators actually reply", () => {
    expect(chooseChannel(reachable)).toBe("whatsapp");
  });

  it("falls back to email when there is no usable number", () => {
    expect(chooseChannel({ ...reachable, phone: null })).toBe("email");
  });

  it("still uses a number found publicly when there is no email", () => {
    expect(
      chooseChannel({ ...reachable, whatsappOptIn: false, email: null }),
    ).toBe("whatsapp");
  });

  it("returns nothing when there is no way to reach them, rather than guessing", () => {
    expect(chooseChannel({ ...reachable, phone: null, email: null })).toBeNull();
  });
});

describe("checkSendAllowed", () => {
  it("allows a first approach to a reachable creator", () => {
    expect(checkSendAllowed(reachable, {}, NOW).allowed).toBe(true);
  });

  it("never messages someone who opted out", () => {
    const result = checkSendAllowed({ ...reachable, doNotContact: true }, {}, NOW);
    expect(result).toMatchObject({ allowed: false, reason: "opted_out" });
  });

  it("refuses an opted-out creator even mid-conversation", () => {
    const result = checkSendAllowed(
      { ...reachable, doNotContact: true },
      { isReply: true },
      NOW,
    );
    expect(result.allowed).toBe(false);
  });

  it("refuses an AI draft that no person approved", () => {
    const result = checkSendAllowed(reachable, { aiDraft: true }, NOW);
    expect(result).toMatchObject({ allowed: false, reason: "not_approved" });
  });

  it("allows an AI draft once a person has approved it", () => {
    expect(
      checkSendAllowed(reachable, { aiDraft: true, approvedBy: "user_ada" }, NOW)
        .allowed,
    ).toBe(true);
  });

  it("holds a second cold approach inside the cooldown", () => {
    const result = checkSendAllowed(
      { ...reachable, lastUnsolicitedAt: daysAgo(2) },
      {},
      NOW,
    );
    expect(result).toMatchObject({ allowed: false, reason: "rate_limited" });
    if (!result.allowed) expect(result.detail).toMatch(/5 days/);
  });

  it("allows a cold approach once the cooldown has passed", () => {
    expect(
      checkSendAllowed(
        { ...reachable, lastUnsolicitedAt: daysAgo(UNSOLICITED_COOLDOWN_DAYS + 1) },
        {},
        NOW,
      ).allowed,
    ).toBe(true);
  });

  it("does not rate-limit a reply inside a live conversation", () => {
    expect(
      checkSendAllowed(
        { ...reachable, lastUnsolicitedAt: daysAgo(1) },
        { isReply: true },
        NOW,
      ).allowed,
    ).toBe(true);
  });

  it("checks the opt-out before the approval state, so the strongest rule wins", () => {
    const result = checkSendAllowed(
      { ...reachable, doNotContact: true },
      { aiDraft: true, approvedBy: "user_ada" },
      NOW,
    );
    expect(result).toMatchObject({ allowed: false, reason: "opted_out" });
  });
});
