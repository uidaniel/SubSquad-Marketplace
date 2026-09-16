import { scoreCreator, type CreatorSignals } from "@/lib/fraud/rules";
import { normaliseNigerianPhone } from "@/lib/payouts/format";

/**
 * Parsing a creator spreadsheet.
 *
 * Written to be forgiving about everything that does not matter and strict
 * about everything that does. The file is somebody's working spreadsheet, so
 * "7.4", "7.4%" and "0.074" all mean the same engagement rate, and "128,400",
 * "128400" and "128.4k" are all the same follower count.
 *
 * What it will not do is guess at a handle or invent a platform: a row missing
 * either is reported rather than imported, because a creator with no handle
 * cannot be contacted and one with the wrong platform gets scored against the
 * wrong norms.
 */

export interface ParsedCreator {
  handle: string;
  platform: string;
  displayName: string;
  followers: number;
  following: number;
  engagementRate: number;
  avgLikes: number;
  avgComments: number;
  phone: string | null;
  email: string | null;
  city: string | null;
  categoryTags: string[];
  bio: string | null;
  contactSource: string;
  /** Computed on import, so nothing unscored can reach a shortlist. */
  fraudScore: number;
  fraudReasons: ReturnType<typeof scoreCreator>["reasons"];
}

export interface RowProblem {
  line: number;
  handle: string | null;
  problem: string;
}

export interface ParseResult {
  creators: ParsedCreator[];
  problems: RowProblem[];
  /** Header names the file had that mean nothing to us, so they can be spotted. */
  ignoredColumns: string[];
}

const KNOWN_COLUMNS = new Set([
  "handle",
  "platform",
  "display_name",
  "followers",
  "following",
  "engagement_rate",
  "avg_likes",
  "avg_comments",
  "phone",
  "email",
  "city",
  "category_tags",
  "bio",
  "contact_source",
]);

const PLATFORMS = new Set(["tiktok", "instagram", "youtube", "x"]);

/**
 * Splits a CSV line, respecting quotes.
 *
 * A bio containing a comma is ordinary, and splitting on every comma would
 * shift every subsequent column by one — which produces a plausible-looking
 * import that is wrong in a way nobody notices until outreach goes out.
 */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      // A doubled quote inside a quoted field is a literal quote.
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      out.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  out.push(current.trim());
  return out;
}

/** "128,400" / "128.4k" / "1.2m" → a number. */
export function parseCount(raw: string): number {
  const cleaned = raw.replace(/[,\s]/g, "").toLowerCase();
  if (!cleaned) return 0;
  const multiplier = cleaned.endsWith("m") ? 1_000_000 : cleaned.endsWith("k") ? 1_000 : 1;
  const value = Number.parseFloat(cleaned.replace(/[km]$/, ""));
  return Number.isFinite(value) ? Math.round(value * multiplier) : 0;
}

/**
 * "7.4", "7.4%" and "0.074" all mean 7.4%.
 *
 * The ambiguity is real: 0.5 could be half a percent or fifty. Anything at or
 * below 1 is read as a fraction, because an engagement rate above 100% is
 * impossible while one below 1% is commonplace.
 */
export function parseEngagementRate(raw: string): number {
  const cleaned = raw.replace(/[%\s]/g, "");
  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value) || value < 0) return 0;
  return value > 1 ? value / 100 : value;
}

export function parseCreatorCsv(text: string): ParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return {
      creators: [],
      problems: [{ line: 1, handle: null, problem: "The file has no rows under its header." }],
      ignoredColumns: [],
    };
  }

  const headers = splitCsvLine(lines[0]).map((h) =>
    h.toLowerCase().replace(/\s+/g, "_"),
  );
  const ignoredColumns = headers.filter((h) => h && !KNOWN_COLUMNS.has(h));

  const creators: ParsedCreator[] = [];
  const problems: RowProblem[] = [];
  const seen = new Set<string>();

  for (let i = 1; i < lines.length; i += 1) {
    const cells = splitCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, index) => {
      row[h] = cells[index] ?? "";
    });

    const lineNumber = i + 1;
    const handle = row.handle?.replace(/^@/, "").trim();
    const platform = row.platform?.toLowerCase().trim();

    if (!handle) {
      problems.push({ line: lineNumber, handle: null, problem: "No handle." });
      continue;
    }
    if (!PLATFORMS.has(platform)) {
      problems.push({
        line: lineNumber,
        handle,
        problem: platform
          ? `"${platform}" is not a platform we index.`
          : "No platform.",
      });
      continue;
    }

    // The same person twice in one file is a copy-paste slip, not two creators.
    const key = `${platform}:${handle.toLowerCase()}`;
    if (seen.has(key)) {
      problems.push({
        line: lineNumber,
        handle,
        problem: "Already appears earlier in this file.",
      });
      continue;
    }
    seen.add(key);

    const followers = parseCount(row.followers ?? "");
    if (followers <= 0) {
      problems.push({
        line: lineNumber,
        handle,
        problem: "No follower count — nothing can be scored without it.",
      });
      continue;
    }

    const signals: CreatorSignals = {
      handle,
      bio: row.bio || null,
      followers,
      following: parseCount(row.following ?? ""),
      engagementRate: parseEngagementRate(row.engagement_rate ?? ""),
      avgLikes: parseCount(row.avg_likes ?? ""),
      avgComments: parseCount(row.avg_comments ?? ""),
    };
    const score = scoreCreator(signals);

    creators.push({
      handle,
      platform,
      displayName: row.display_name?.trim() || handle,
      followers,
      following: signals.following,
      engagementRate: signals.engagementRate,
      avgLikes: signals.avgLikes,
      avgComments: signals.avgComments,
      phone: row.phone ? normaliseNigerianPhone(row.phone) : null,
      email: row.email?.trim() || null,
      city: row.city?.trim() || null,
      categoryTags: (row.category_tags ?? "")
        .split(";")
        .map((t) => t.trim())
        .filter(Boolean),
      bio: row.bio?.trim() || null,
      contactSource: row.contact_source?.trim() || "manual",
      fraudScore: score.score,
      fraudReasons: score.reasons,
    });
  }

  return { creators, problems, ignoredColumns };
}
