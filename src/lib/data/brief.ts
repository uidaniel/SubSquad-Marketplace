import type { Brief } from "@/lib/domain";

/**
 * Turning a stored brief into the shape the app expects.
 *
 * The brief is `jsonb`, so nothing checks its keys. Rows written by the campaign
 * form carry snake_case (`key_messages`), rows written by earlier code and the
 * fixtures carry camelCase (`keyMessages`), and a brief saved as a draft may be
 * missing either. A cast asserts a shape rather than producing one, so
 * `brief.keyMessages.map(...)` threw "Cannot read properties of undefined" on a
 * real campaign the moment somebody tried to generate a shortlist.
 *
 * This accepts both spellings and fills every field, so callers can rely on the
 * whole object existing. It lives here rather than in a query module because
 * the AI code reads campaigns directly and needs it just as much — the two
 * copies that existed before were exactly the ones that had it, and the two
 * call sites that crashed were the ones that did not.
 */
export function toBrief(raw: unknown): Brief {
  const b = (raw ?? {}) as Record<string, unknown>;

  const pick = <T,>(snake: string, camel: string, fallback: T): T =>
    (b[snake] as T) ?? (b[camel] as T) ?? fallback;

  /** Arrays must be arrays: a string or null here is what breaks `.map`. */
  const list = (snake: string, camel: string): string[] => {
    const value = b[snake] ?? b[camel];
    return Array.isArray(value) ? (value as string[]) : [];
  };

  const audience = (b.audience ?? {}) as Record<string, unknown>;

  return {
    objective: pick("objective", "objective", "awareness") as Brief["objective"],
    product: pick("product", "product", ""),
    keyMessages: list("key_messages", "keyMessages"),
    mustInclude: list("must_include", "mustInclude"),
    mustAvoid: list("must_avoid", "mustAvoid"),
    audience: {
      ageRange:
        ((audience.age_range ?? audience.ageRange) as [number, number]) ?? [18, 44],
      gender: (audience.gender as Brief["audience"]["gender"]) ?? "any",
      cities: Array.isArray(audience.cities) ? (audience.cities as string[]) : [],
      languages: Array.isArray(audience.languages)
        ? (audience.languages as string[])
        : ["English"],
    },
    platforms: list("platforms", "platforms"),
    tone: pick("tone", "tone", ""),
    disclosureTag: pick("disclosure_tag", "disclosureTag", "#ad"),
    arconCategory: pick(
      "arcon_category",
      "arconCategory",
      "general",
    ) as Brief["arconCategory"],
    usageRightsDays: Number(pick("usage_rights_days", "usageRightsDays", 90)),
  };
}
