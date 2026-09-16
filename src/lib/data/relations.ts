/**
 * Supabase types an embedded relation as an array even when the foreign key
 * guarantees at most one row, so `deal.creators` comes back as `Creator[]`
 * where the query means one creator.
 *
 * Casting at each call site is how `as any` spreads through a codebase. This
 * narrows it once, and returns null rather than throwing when the relation is
 * genuinely absent — a deal with no campaign is ordinary, not an error.
 */
export function one<T>(
  relation: T | T[] | null | undefined,
): Record<string, unknown> | null {
  if (!relation) return null;
  const row = Array.isArray(relation) ? relation[0] : relation;
  return (row as Record<string, unknown>) ?? null;
}
