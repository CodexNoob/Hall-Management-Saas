"use client";

import { useId, useLayoutEffect, useReducer, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { CountryCode } from "libphonenumber-js";

import {
  DEFAULT_PHONE_COUNTRY,
  PHONE_COUNTRIES,
  findPhoneCountry,
  formatAsYouType,
  parsePhoneInput
} from "@/lib/validation/phone";

type PhoneFieldProps = {
  id?: string;
  name?: string;
  /** Used in the error copy, e.g. "Vendor phone is required." */
  label?: string;
  /** Selected country. Drives both validation and the typing format. */
  country: CountryCode;
  onCountryChange: (country: CountryCode) => void;
  /** The national part, exactly as typed. Never coerced on keystroke. */
  value: string;
  onChange: (raw: string) => void;
  /** Fires with E.164 once valid, or `null` when the field is empty. */
  onValidChange?: (e164: string | null) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** A server-side rejection, shown while there is no local error. */
  serverError?: string;
  className?: string;
  /** The select + input group. Put any bordered "one control" styling here, so
   *  the error message renders below the border rather than inside it. */
  rowClassName?: string;
  /** The country control. Styles the visible trigger, not the `<select>` itself
   *  - see the comment on it below. Give it a fixed width: the trigger's text is
   *  short and of near-constant length, so a width keeps the number input from
   *  shifting sideways when the country changes. */
  countryClassName?: string;
  inputClassName?: string;
  errorClassName?: string;
  /** The "only digits and + ( ) -" hint shown when characters are filtered. */
  noticeClassName?: string;
};

/**
 * A phone input that only accepts a number that could actually exist in the
 * selected country.
 *
 * The country picker is not decoration: the same digits are a valid mobile in
 * one country and impossible in another, so validation cannot happen without
 * it. Storing the ISO code rather than the dialling code matters too, because
 * `+1` alone is the US, Canada and twenty-odd more.
 *
 * Like `NumberField`, this stays `type="tel"` over raw text and keeps whatever
 * was typed, so the validator can report "that is not a valid number" instead
 * of silently receiving an empty string.
 */
export function PhoneField({
  id,
  name,
  label = "Phone number",
  country,
  onCountryChange,
  value,
  onChange,
  onValidChange,
  required = false,
  disabled,
  placeholder,
  serverError,
  className,
  rowClassName = "flex",
  countryClassName,
  inputClassName,
  errorClassName = "mt-1 text-xs font-bold text-[#c2410c]",
  noticeClassName = "mt-1 text-xs font-semibold text-[#64748b]"
}: PhoneFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const errorId = `${fieldId}-error`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [touched, setTouched] = useState(false);
  const [notice, setNotice] = useState("");
  const caretRef = useRef<number | null>(null);
  // Bumped whenever the caret needs restoring, purely to guarantee a commit.
  const [, nudge] = useReducer((count: number) => count + 1, 0);
  const noticeId = `${fieldId}-notice`;

  // The value is owned by the parent, so React re-renders with the filtered
  // text and the browser parks the caret at the end. Put it back before paint.
  useLayoutEffect(() => {
    const input = inputRef.current;

    if (input && caretRef.current !== null) {
      input.setSelectionRange(caretRef.current, caretRef.current);
      caretRef.current = null;
    }
  });

  // Falls back to the bare ISO code rather than blanking the trigger, for a
  // country libphonenumber has no calling code for.
  const selectedCountry = findPhoneCountry(country) ?? {
    code: country,
    callingCode: ""
  };
  const result = parsePhoneInput(value, { country, label });
  const localError =
    result.status === "invalid"
      ? result.message
      : required && result.status === "empty"
        ? `${label} is required.`
        : "";
  // Only complain once the field has been left, so it does not scream at a
  // number that is merely half typed.
  const error = touched ? localError : serverError ?? "";

  const emit = (raw: string, nextCountry: CountryCode) => {
    const next = parsePhoneInput(raw, { country: nextCountry, label });

    if (next.status === "valid") onValidChange?.(next.value);
    else if (next.status === "empty") onValidChange?.(null);
  };

  const announceDrop = () => {
    // A live region only speaks when its CONTENT changes, so re-setting the
    // same sentence is silent. Clear it, then let a later task carry the text
    // in, which is what makes the second rejected keystroke announce too.
    setNotice("");
    setTimeout(() => setNotice(DROP_NOTICE), 0);
  };

  const handleChange = (raw: string) => {
    const input = inputRef.current;
    const caret = input?.selectionStart ?? raw.length;
    const cleaned = raw.replace(DISALLOWED, "");

    // Say so rather than dropping characters in silence. A field that just
    // refuses to type reads as broken, and a screen reader gets nothing at all.
    if (cleaned !== raw) announceDrop();
    else setNotice("");

    // Reformat only while the caret sits at the end. Rewriting the text under a
    // caret parked mid-string would throw it to the end on every keystroke.
    const atEnd = caret >= raw.length;
    const next = atEnd ? formatSafely(cleaned, country) : cleaned;

    if (atEnd) {
      // Nothing to restore, and leaving a previous index behind would let it be
      // applied to this keystroke instead.
      caretRef.current = null;
    } else {
      // Removing characters shortens the text before the caret, so the caret
      // has to move back by however many were taken out ahead of it.
      const before = raw.slice(0, caret);
      caretRef.current = caret - (before.length - before.replace(DISALLOWED, "").length);
      // Filtering can leave `next` identical to the current value, in which
      // case neither this component nor the parent would re-render and the
      // layout effect above would never run - stranding the index to be
      // applied, wrongly, to some later keystroke. Force the commit.
      nudge();
    }

    onChange(next);
    emit(next, country);
  };

  const handleCountryChange = (nextCountry: CountryCode) => {
    onCountryChange(nextCountry);
    // The same digits mean a different number under a different country, so
    // re-run validation rather than leaving a stale verdict on screen.
    emit(value, nextCountry);
  };

  return (
    <div className={className}>
      <div className={rowClassName}>
        {/* What you see is the trigger; the `<select>` is a transparent overlay
            sitting on top of it.

            A native select is as wide as its widest option, and this list runs
            to "United States Minor Outlying Islands (+1)" - so the width has to
            be capped, and capping it clipped the SELECTED country to
            "Philippines (+6". Nothing about the closed control can be styled
            away from that: the browser paints the chosen option's own text.

            So the trigger shows the ISO code and dialling code, which is all
            the closed state needs to say and is a near-constant width. The
            select keeps every full country name for the open menu, keeps its
            label, keyboard behaviour and autofill, and on a phone still hands
            over to the platform's own picker. */}
        <div
          className={`relative inline-flex shrink-0 items-center gap-1.5 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 ${
            disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
          } ${countryClassName ?? ""}`}
        >
          {/* Hidden from assistive tech: it is the select that is labelled, and
              announcing "PH +63" alongside it would just be said twice. */}
          <span aria-hidden="true">{selectedCountry.code}</span>
          <span aria-hidden="true" className="tabular-nums opacity-70">
            {selectedCountry.callingCode}
          </span>
          <ChevronDown aria-hidden="true" className="ml-auto size-3.5 shrink-0 opacity-60" />

          <select
            aria-label="Country"
            autoComplete="tel-country-code"
            className="absolute inset-0 size-full cursor-[inherit] opacity-0"
            disabled={disabled}
            id={`${fieldId}-country`}
            name={name ? `${name}Country` : undefined}
            onChange={(event) =>
              handleCountryChange(event.target.value as CountryCode)
            }
            value={country}
          >
            {PHONE_COUNTRIES.map((entry) => (
              <option key={entry.code} value={entry.code}>
                {entry.name} ({entry.callingCode})
              </option>
            ))}
          </select>
        </div>

        <input
          ref={inputRef}
          aria-describedby={
            [error ? errorId : "", notice ? noticeId : ""]
              .filter(Boolean)
              .join(" ") || undefined
          }
          aria-invalid={error ? true : undefined}
          autoComplete="tel-national"
          className={inputClassName}
          disabled={disabled}
          id={fieldId}
          inputMode="tel"
          name={name}
          onBlur={() => {
            setTouched(true);
            setNotice("");
          }}
          onChange={(event) => handleChange(event.target.value)}
          placeholder={placeholder ?? examplePlaceholder(country)}
          type="tel"
          value={value}
        />
      </div>

      {error ? (
        <p className={errorClassName} id={errorId} role="alert">
          {error}
        </p>
      ) : null}

      {/* Always mounted, empty when there is nothing to say. Assistive tech
          only reports changes to live regions it registered beforehand, so a
          region that appears already carrying its text is not announced. */}
      <p
        aria-live="polite"
        className={notice ? noticeClassName : "sr-only"}
        id={noticeId}
      >
        {notice}
      </p>
    </div>
  );
}

/**
 * Characters that may never appear in a phone number.
 *
 * Filtering rather than rejecting the whole entry is what makes paste usable:
 * "Tel: +63 917 123 4567" keeps the number and loses the label, where refusing
 * the input outright would just look broken.
 *
 * `\p{Nd}` with the `u` flag, NOT `\d`, which is ASCII-only. A CJK keyboard
 * emits full-width digits and an Arabic one emits ٠-٩; libphonenumber accepts
 * both and normalizes them, so stripping them would blank the field for
 * someone who typed nothing but digits.
 *
 * This deliberately does NOT stand in for validation. It only decides what may
 * be typed; whether the digits form a real number is still `parsePhoneInput`'s
 * call, on both this side and the server's.
 */
const DISALLOWED = /[^\p{Nd}\s()+.\-]/gu;

const DROP_NOTICE = "A phone number can only contain digits and + ( ) - .";

/**
 * Formats, but never at the cost of the user's digits.
 *
 * `AsYouType` gives up silently on input it does not expect and returns an
 * empty string - a single leading space before a "+" is enough, which is
 * exactly what pasting "Tel: +63 917 123 4567" leaves behind. Falling back to
 * the unformatted text keeps the number; trusting the formatter would erase it.
 */
function formatSafely(cleaned: string, country: CountryCode) {
  // Leading whitespace is never meaningful, and removing it lets the common
  // pasted-from-a-signature case format properly instead of just surviving.
  const trimmed = cleaned.replace(/^\s+/, "");
  const formatted = formatAsYouType(trimmed, country);

  return digits(formatted) === digits(trimmed) ? formatted : trimmed;
}

function digits(value: string) {
  // Unicode-aware for the same reason as DISALLOWED: `\D` would count a
  // full-width digit as a non-digit and make the guard reject a good format.
  return value.replace(/[^\p{Nd}]/gu, "");
}

/**
 * Shows the shape of a real number for the chosen country, derived from the
 * metadata so it cannot drift from what the validator will accept.
 */
function examplePlaceholder(country: CountryCode) {
  const sample =
    country === DEFAULT_PHONE_COUNTRY ? "2125550123" : SAMPLES[country];

  return sample ? formatAsYouType(sample, country) : "Phone number";
}

/**
 * A handful of well-known national numbers, only for the placeholder. Kept
 * small on purpose - `libphonenumber-js/examples.mobile.json` would pull in a
 * second metadata file for what is a cosmetic hint.
 */
const SAMPLES: Partial<Record<CountryCode, string>> = {
  GB: "7400123456",
  PH: "9171234567",
  IN: "8123456789",
  CA: "5062345678",
  AU: "412345678"
};
