"use client";

import { useId, useRef, useState } from "react";
import type { CountryCode } from "libphonenumber-js";

import {
  DEFAULT_PHONE_COUNTRY,
  PHONE_COUNTRIES,
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
  selectClassName?: string;
  inputClassName?: string;
  errorClassName?: string;
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
  selectClassName,
  inputClassName,
  errorClassName = "mt-1 text-xs font-bold text-[#c2410c]"
}: PhoneFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const errorId = `${fieldId}-error`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [touched, setTouched] = useState(false);

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

  const handleChange = (raw: string) => {
    const input = inputRef.current;
    // Reformat only while the caret sits at the end. Rewriting the text under a
    // caret parked mid-string would throw it to the end on every keystroke.
    const atEnd =
      !input || input.selectionStart === null || input.selectionStart >= raw.length;
    const next = atEnd && isFormattable(raw) ? formatAsYouType(raw, country) : raw;

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
        <select
          aria-label="Country"
          autoComplete="tel-country-code"
          className={selectClassName}
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

        <input
          ref={inputRef}
          aria-describedby={error ? errorId : undefined}
          aria-invalid={error ? true : undefined}
          autoComplete="tel-national"
          className={inputClassName}
          disabled={disabled}
          id={fieldId}
          inputMode="tel"
          name={name}
          onBlur={() => setTouched(true)}
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
    </div>
  );
}

/**
 * Whether it is safe to run the formatter over this text.
 *
 * `AsYouType` keeps only the digits it recognises and drops everything else:
 * "212abc555" comes back as "(212)" and "abcdefghij" as "". Formatting through
 * it would therefore swallow a typo and leave the field looking merely empty -
 * the same failure as a `type="number"` input discarding what it cannot parse,
 * which is the whole reason this component exists. So anything with a stray
 * character is left exactly as typed, for the validator to report on.
 */
function isFormattable(raw: string) {
  return /^[\d\s()+.-]*$/.test(raw);
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
