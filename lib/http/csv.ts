/**
 * RFC 4180 field escaping, in one place.
 *
 * An export is what a security questionnaire actually asks to see, and there are
 * now two of them - the privilege audit and the activity history. Two copies of
 * an escape rule is one copy that gets fixed when a client name with a comma in
 * it breaks the file, and one that does not.
 *
 * Double the quotes; wrap anything carrying a comma, a quote or a newline.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";

  const text = typeof value === "string" ? value : JSON.stringify(value);

  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** One CSV row, already escaped. */
export function csvRow(values: readonly unknown[]): string {
  return values.map(csvCell).join(",");
}
