import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merges class names, letting a caller's utility win over a component default. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** "22 Aug" / "22 Aug 2025" — the year only appears when it is not this one. */
export function formatDate(
  input: string | Date | null | undefined,
  now = new Date(),
): string {
  // Null is ordinary, not exceptional: a campaign saved as a draft has no
  // deadline yet, and a deal that has not been published has no published_at.
  // `typeof null === "object"`, so without this the string branch is skipped
  // and `.getTime()` is called on null — which is how a missing deadline took
  // down the whole dashboard.
  if (input === null || input === undefined) return "—";
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return "—";
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** "in 3 days" / "2 hours ago" — deadlines read better as distance than as a date. */
export function formatRelative(
  input: string | Date | null | undefined,
  now = new Date(),
): string {
  if (input === null || input === undefined) return "—";
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return "—";
  const diffMs = d.getTime() - now.getTime();
  const abs = Math.abs(diffMs);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < hour) return rtf.format(Math.round(diffMs / minute), "minute");
  if (abs < day) return rtf.format(Math.round(diffMs / hour), "hour");
  if (abs < 30 * day) return rtf.format(Math.round(diffMs / day), "day");
  return formatDate(d, now);
}

/** Initials for an avatar: "Konga Digital" → "KD", "Chidera O." → "CO". */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * A stable colour for an avatar, picked from the palette rather than at random
 * so the same person is the same colour on every screen and every session.
 */
const AVATAR_COLOURS = [
  "#2F5FA8",
  "#11764C",
  "#6E3D9E",
  "#A8690F",
  "#B3261E",
  "#0E6B46",
  "#1F3DE0",
] as const;

export function avatarColour(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return AVATAR_COLOURS[Math.abs(hash) % AVATAR_COLOURS.length];
}

/** Compact follower counts: 128400 → "128k", 1840000 → "1.8m". */
export function formatCount(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${m >= 10 ? m.toFixed(0) : m.toFixed(1).replace(/\.0$/, "")}m`;
  }
  if (n >= 1_000) {
    const k = n / 1_000;
    return `${k >= 10 ? k.toFixed(0) : k.toFixed(1).replace(/\.0$/, "")}k`;
  }
  return String(n);
}

/** 0.074 → "7.4%" */
export function formatPercent(fraction: number, digits = 1): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}
