import type { z } from "zod";
import { parseNumericInput } from "@/lib/validation/number";

export type NumericFieldSpec = {
  /** Raw input text as the user typed it. */
  raw: string;
  schema: z.ZodType<number>;
  /** Whether an empty field is a legitimate "not set" rather than an error. */
  allowEmpty?: boolean;
  /** Message when the field is empty and `allowEmpty` is false. */
  emptyMessage?: string;
};

export type NumericFormResult<TKey extends string> =
  | { ok: true; values: Record<TKey, number | null> }
  | { ok: false; errors: Partial<Record<TKey, string>>; firstError: string };

/**
 * Validates a whole form's numeric fields in one pass at submit time.
 *
 * Use this for the hand-rolled dialogs that submit everything at once; use the
 * `NumberField` component where a field validates itself on blur. Both go
 * through `parseNumericInput`, so an empty or unparseable field can never come
 * back as a number.
 */
export function readNumericFields<TKey extends string>(
  fields: Record<TKey, NumericFieldSpec>
): NumericFormResult<TKey> {
  const values = {} as Record<TKey, number | null>;
  const errors: Partial<Record<TKey, string>> = {};
  let firstError = "";

  for (const key of Object.keys(fields) as TKey[]) {
    const { raw, schema, allowEmpty = false, emptyMessage } = fields[key];
    const result = parseNumericInput(raw, schema);

    if (result.status === "valid") {
      values[key] = result.value;
      continue;
    }

    if (result.status === "empty") {
      if (allowEmpty) {
        values[key] = null;
        continue;
      }

      const message = emptyMessage ?? "Enter a number.";
      errors[key] = message;
      firstError ||= message;
      continue;
    }

    errors[key] = result.message;
    firstError ||= result.message;
  }

  if (firstError) return { ok: false, errors, firstError };

  return { ok: true, values };
}
