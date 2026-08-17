/**
 * Allergen tags, between the dialog's one text input and the `text[]` column.
 *
 * A text array rather than a join table because these are labels, not entities:
 * nothing else in the system references "nuts", it has no lifecycle of its own,
 * and a containment query is all anyone will ever ask of it. That is the line
 * this schema draws - an array is wrong when it stands in for a relationship to
 * a row that has its own life, and fine when it holds words.
 *
 * Keep free of `server-only` and Prisma: the dialog imports it.
 */

/** Matches the per-tag bound in `menuItemFieldsSchema`. */
const MAX_TAG_LENGTH = 40;
const MAX_TAGS = 20;

/**
 * Splits what the user typed into tags.
 *
 * Deduped case-insensitively but stored as typed, so "Nuts" and "nuts" cannot
 * both end up on one dish while the operator's own capitalisation survives.
 */
export function parseAllergens(raw: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];

  for (const part of raw.split(",")) {
    const tag = part.trim().slice(0, MAX_TAG_LENGTH);

    if (!tag) continue;

    const key = tag.toLowerCase();

    if (seen.has(key)) continue;

    seen.add(key);
    tags.push(tag);

    if (tags.length === MAX_TAGS) break;
  }

  return tags;
}

/** The reverse, for seeding the input on an edit. */
export function formatAllergens(tags: string[]): string {
  return tags.join(", ");
}
