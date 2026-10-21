"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { z } from "zod";
import {
  parseNumericInput,
  type NumericParseResult,
  type ValidationTranslate
} from "@/lib/validation/number";
import { useAppLanguage } from "@/components/providers/app-language-provider";

type NumberFieldProps = {
  id?: string;
  name?: string;
  /** The same schema the route handler uses, so the layers cannot drift. */
  schema: z.ZodType<number>;
  /** Raw input text. The parent owns it; it is never coerced on keystroke. */
  value: string;
  onChange: (raw: string) => void;
  /**
   * Fires with the parsed number once the field is valid, or `null` when the
   * field is genuinely empty and `allowEmpty` is set. It never fires with a
   * value derived from unparseable text.
   */
  onValidChange?: (value: number | null) => void;
  /** Whether clearing the field is a legitimate "not set". */
  allowEmpty?: boolean;
  emptyMessage?: string;
  /** Opt back into type="number" where arrow-key nudging is worth the trade-off. */
  spinner?: boolean;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  /** A server-side rejection for this field, shown when there is no local error. */
  serverError?: string;
};

/**
 * A numeric input that can actually see what the user typed.
 *
 * Defaults to `type="text"` with `inputMode="decimal"` on purpose. With
 * `type="number"` the browser runs its value-sanitization algorithm and hands
 * JavaScript an empty string for anything it cannot parse - so "abc" and a
 * deliberately cleared field are indistinguishable, and `Number("")` quietly
 * becomes `0`. Reading the raw text is the only way to tell the user that what
 * they typed is not a number, and `inputMode="decimal"` keeps the numeric
 * keypad on mobile.
 */
export function NumberField({
  id,
  name,
  schema,
  value,
  onChange,
  onValidChange,
  allowEmpty = false,
  emptyMessage,
  spinner = false,
  className,
  placeholder,
  disabled,
  serverError
}: NumberFieldProps) {
  const { t } = useAppLanguage();
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const errorId = `${fieldId}-error`;
  const [touched, setTouched] = useState(false);
  // Defaulted here rather than in the parameter list, which is evaluated
  // before any hook has run and so could only ever be English.
  const blankMessage = emptyMessage ?? t("shell.enterANumber");

  const result = evaluate(value, schema, allowEmpty, blankMessage, t);
  // Only complain once the user has left the field, so it does not scream
  // while a number is still being typed.
  const localError = touched && result.status === "invalid" ? result.message : "";
  const error = localError || (touched ? "" : serverError ?? "");

  const handleChange = (raw: string) => {
    onChange(raw);

    const next = evaluate(raw, schema, allowEmpty, blankMessage, t);

    if (next.status === "valid") onValidChange?.(next.value);
    else if (next.status === "empty" && allowEmpty) onValidChange?.(null);
  };

  return (
    <>
      <input
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        className={className}
        disabled={disabled}
        id={fieldId}
        inputMode={spinner ? undefined : "decimal"}
        name={name}
        onBlur={() => setTouched(true)}
        onChange={(event) => handleChange(event.target.value)}
        placeholder={placeholder}
        type={spinner ? "number" : "text"}
        value={value}
      />
      {error ? (
        <p className="mt-1 text-xs font-bold text-[#c2410c]" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}

type LiveNumberFieldProps = {
  id: string;
  name?: string;
  schema: z.ZodType<number>;
  /** The committed value, owned by the parent's numeric state. */
  value: number | null | undefined;
  /** Called only when the typed text parses. Never fires with NaN or 0-from-empty. */
  onCommit: (value: number) => void;
  disabled?: boolean;
  className?: string;
  errorClassName?: string;
};

/**
 * For fields whose parent keeps a NUMBER and expects live updates - a canvas
 * position, a plan headcount that recomputes totals as you type.
 *
 * It owns the raw text itself and pushes a number out only once that text
 * parses, so a half-typed or unparseable entry cannot reach the parent. The
 * box re-syncs from `value` whenever the parent changes it from elsewhere
 * (dragging a shape, loading a different record) but never mid-edit.
 */
export function LiveNumberField({
  id,
  name,
  schema,
  value,
  onCommit,
  disabled,
  className,
  errorClassName = "mt-1 text-[10px] font-bold text-[#c2410c]"
}: LiveNumberFieldProps) {
  const { t } = useAppLanguage();
  const externalText = value === null || value === undefined ? "" : String(value);
  const [raw, setRaw] = useState(externalText);
  const [editing, setEditing] = useState(false);
  // What the parent held before this edit began, so a half-typed value can be
  // rolled back rather than left behind.
  const valueBeforeEdit = useRef<number | null>(null);
  const errorId = `${id}-error`;

  useEffect(() => {
    if (!editing) setRaw(externalText);
  }, [externalText, editing]);

  const result = parseNumericInput(raw, schema, t);
  const error =
    editing && result.status === "invalid"
      ? result.message
      : editing && result.status === "empty"
        ? t("shell.enterANumber")
        : "";

  return (
    <>
      <input
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        className={className}
        disabled={disabled}
        id={id}
        inputMode="decimal"
        name={name}
        onBlur={() => {
          setEditing(false);

          // Committing per keystroke means an intermediate prefix can be left
          // behind: typing "60" into a 1-50 field commits 6 on the first
          // keystroke, then stops once "60" is out of range. Roll back to what
          // the parent held before the edit rather than keeping that 6.
          const parsed = parseNumericInput(raw, schema, t);

          if (parsed.status !== "valid" && valueBeforeEdit.current !== null) {
            onCommit(valueBeforeEdit.current);
            setRaw(String(valueBeforeEdit.current));
            return;
          }

          setRaw(externalText);
        }}
        onChange={(event) => {
          const next = event.target.value;
          if (!editing) {
            valueBeforeEdit.current =
              value === null || value === undefined ? null : value;
          }
          setEditing(true);
          setRaw(next);

          const parsed = parseNumericInput(next, schema, t);
          if (parsed.status === "valid") onCommit(parsed.value);
        }}
        type="text"
        value={raw}
      />
      {error ? (
        <p className={errorClassName} id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}

function evaluate(
  raw: string,
  schema: z.ZodType<number>,
  allowEmpty: boolean,
  emptyMessage: string,
  t: ValidationTranslate
): NumericParseResult {
  const result = parseNumericInput(raw, schema, t);

  if (result.status === "empty" && !allowEmpty) {
    return { status: "invalid", message: emptyMessage };
  }

  return result;
}
