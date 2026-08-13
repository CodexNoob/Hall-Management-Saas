export type ZodFieldErrors = Record<string, string[] | undefined>;

export type FlattenedZodError = {
  formErrors: string[];
  fieldErrors: ZodFieldErrors;
};

/**
 * "basePrice" -> "Base price", "amountCents" -> "Amount cents".
 * Nested paths arrive dot-joined ("lineItems.0.quantity"); only the last
 * meaningful segment is worth showing, and numeric indices are dropped.
 */
export function humanizeFieldName(name: string): string {
  const segments = name.split(".").filter((part) => part && !/^\d+$/.test(part));
  const last = segments[segments.length - 1] ?? name;
  const spaced = last
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();

  if (!spaced) return name;

  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

/**
 * Turns a flattened ZodError into one sentence a person can act on.
 *
 * The API used to answer every schema failure with a bare "Invalid request.",
 * which told the user nothing about which field to correct.
 */
export function formatZodErrorMessage(error: FlattenedZodError): string {
  const fieldEntries = Object.entries(error.fieldErrors).filter(
    ([, messages]) => messages && messages.length > 0
  );
  const messages: string[] = [];

  for (const [field, fieldMessages] of fieldEntries) {
    const first = fieldMessages?.[0];
    if (!first) continue;

    // Schema messages built by lib/validation/number.ts already start with the
    // field label, so prefixing again would read "Capacity: Capacity must...".
    const label = humanizeFieldName(field);
    messages.push(
      first.toLowerCase().startsWith(label.toLowerCase())
        ? first
        : `${label}: ${first}`
    );
  }

  for (const formError of error.formErrors) {
    if (formError) messages.push(formError);
  }

  if (messages.length === 0) return "Invalid request.";

  const [first] = messages;
  const remaining = messages.length - 1;

  return remaining > 0
    ? `${first} (and ${remaining} more ${remaining === 1 ? "issue" : "issues"})`
    : first;
}
