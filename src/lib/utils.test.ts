import { describe, expect, it } from "vitest";
import { formatDate, formatRelative, formatCount, initialsOf } from "./utils";

const NOW = new Date("2026-09-16T12:00:00.000Z");

describe("formatDate", () => {
  // The case that took the dashboard down: a campaign saved as a draft has no
  // deadline, `typeof null === "object"`, and `.getTime()` on null throws
  // inside a .map() that renders every row on the page.
  it("renders a dash for a missing date rather than throwing", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
  });

  it("renders a dash for an unparseable date", () => {
    expect(formatDate("not a date")).toBe("—");
  });

  it("omits the year when it is the current one", () => {
    expect(formatDate("2026-08-22T00:00:00Z", NOW)).toBe("22 Aug");
  });

  it("shows the year when it is not", () => {
    expect(formatDate("2025-08-22T00:00:00Z", NOW)).toBe("22 Aug 2025");
  });
});

describe("formatRelative", () => {
  it("renders a dash for a missing date rather than throwing", () => {
    expect(formatRelative(null)).toBe("—");
    expect(formatRelative(undefined)).toBe("—");
  });

  it("counts forward to a deadline", () => {
    expect(formatRelative("2026-09-19T12:00:00Z", NOW)).toBe("in 3 days");
  });

  it("counts back from something that happened", () => {
    expect(formatRelative("2026-09-16T10:00:00Z", NOW)).toBe("2 hours ago");
  });

  it("falls back to a date once it is far enough away", () => {
    expect(formatRelative("2026-12-25T12:00:00Z", NOW)).toBe("25 Dec");
  });
});

describe("formatCount", () => {
  it.each([
    [128_400, "128k"],
    [1_840_000, "1.8m"],
    [9_400, "9.4k"],
    [820, "820"],
  ])("renders %i as %s", (input, expected) => {
    expect(formatCount(input)).toBe(expected);
  });
});

describe("initialsOf", () => {
  it("takes the first and last initial", () => {
    expect(initialsOf("Konga Digital")).toBe("KD");
    expect(initialsOf("Chidera O.")).toBe("CO");
  });

  it("copes with a single name", () => {
    expect(initialsOf("Chidera")).toBe("CH");
  });

  it("copes with nothing usable", () => {
    expect(initialsOf("   ")).toBe("?");
  });
});
