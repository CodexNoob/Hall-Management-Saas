import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode
} from "libphonenumber-js";
import { z } from "zod";

import type { ValidationTranslate } from "@/lib/validation/number";

/**
 * Shared phone vocabulary for forms and route handlers, the string counterpart
 * to `lib/validation/number.ts`.
 *
 * Both layers import from here so a number cannot be accepted in the browser
 * and rejected on the server. Pure Zod plus libphonenumber - no `server-only`,
 * no Prisma - so client components can import it too.
 *
 * Why a library rather than a regex: "is this a real phone number" is not a
 * pattern question. Valid lengths and prefixes differ per country and per line
 * type, and the numbering plans change. libphonenumber carries Google's
 * metadata for all 245 calling territories.
 *
 * What it does and does not prove:
 * - It DOES reject letters, wrong lengths, and unassigned prefix ranges.
 * - It does NOT prove the line exists or that anyone answers it. That needs a
 *   carrier lookup (Twilio/Vonage) or an OTP, which is a separate decision.
 */

/**
 * Storage format. Every number this module accepts is normalized to E.164
 * (`+639171234567`) so the same line is one string no matter how it was typed -
 * which is what makes deduping a client by phone possible.
 */
export type E164 = string;

/**
 * Used when a submitted number has no `+` and so carries no country of its own.
 * The forms always send E.164, so this only matters for values arriving from
 * elsewhere, such as Supabase user metadata.
 */
export const DEFAULT_PHONE_COUNTRY: CountryCode = "US";

export type PhoneParseResult =
  | { status: "empty" }
  | { status: "invalid"; message: string }
  | { status: "valid"; value: E164; national: string; country?: CountryCode };

/**
 * Turns raw input into a validated, normalized number.
 *
 * Mirrors `parseNumericInput`: the three-way result forces callers to handle
 * "not filled in" separately from "filled in wrong", so an empty field can
 * never be mistaken for a bad one.
 */
export function parsePhoneInput(
  raw: string,
  {
    country,
    label,
    t
  }: {
    country?: CountryCode;
    label?: string;
    t?: ValidationTranslate;
  } = {}
): PhoneParseResult {
  const name = label ?? (t ? t("common.phoneNumber") : "Phone number");
  const trimmed = raw.trim();

  if (trimmed === "") return { status: "empty" };

  // Cheap guard first, so "hello" gets a clear message rather than whatever the
  // parser makes of it, and so a pasted essay is not handed to the metadata.
  if (trimmed.length > 40 || /[a-z]/i.test(trimmed)) {
    return {
      status: "invalid",
      message: t
        ? t("validation.phonePunctuation", { label: name })
        : `${name} must contain only digits and phone punctuation.`
    };
  }

  const parsed = parsePhoneNumberFromString(trimmed, country);

  if (!parsed) {
    return {
      status: "invalid",
      message: t
        ? t("validation.enterValidPhone", { label: lower(name) })
        : `Enter a valid ${lower(name)}.`
    };
  }

  if (!parsed.isValid()) {
    // libphonenumber leaves `country` undefined on an invalid number, so name
    // the country only when we genuinely know which one was meant: either it
    // worked it out, or the value had no `+` and so used the caller's hint.
    // Guessing from the calling code would be wrong - `+1` is 20-odd countries.
    const region = parsed.country ?? (trimmed.startsWith("+") ? undefined : country);

    return {
      status: "invalid",
      message: region
        ? t
          ? t("validation.notValidRegionPhone", { region: regionName(region) })
          : `That is not a valid ${regionName(region)} phone number.`
        : t
          ? t("validation.enterValidPhone", { label: lower(name) })
          : `Enter a valid ${lower(name)}.`
    };
  }

  return {
    status: "valid",
    value: parsed.number,
    national: parsed.formatNational(),
    country: parsed.country
  };
}

type PhoneSchemaOptions = {
  label?: string;
  /** Reject an empty value. Most phone fields in this app are optional. */
  required?: boolean;
  /** Applied only to values that arrive without a leading `+`. */
  defaultCountry?: CountryCode;
};

/**
 * A Zod schema that accepts only a real phone number and outputs E.164.
 *
 * Optional by default and `undefined` when blank, so a field nobody filled in
 * stays empty rather than becoming a validation error - every phone column in
 * this app except `Event.phone` is nullable.
 */
export function phoneSchema(options: PhoneSchemaOptions = {}) {
  const schema = buildPhoneSchema(options);

  // `.optional()` so the KEY may be absent, not merely blank. Without it every
  // caller that omits `phone` entirely would fail with "Required".
  return options.required ? schema : schema.optional();
}

/** `phoneSchema` that must be present. Outputs a definite E.164 string. */
export function requiredPhoneSchema(
  options: Omit<PhoneSchemaOptions, "required"> = {}
) {
  // The pipe re-narrows `string | undefined` back to `string`: the refinement
  // above has already rejected the empty case, but the transform's return type
  // cannot express that on its own.
  return buildPhoneSchema({ ...options, required: true }).pipe(
    z.string({
      required_error: `${options.label ?? "Phone number"} is required.`
    })
  );
}

function buildPhoneSchema({
  label = "Phone number",
  required = false,
  defaultCountry = DEFAULT_PHONE_COUNTRY
}: PhoneSchemaOptions) {
  return z
    .string({ invalid_type_error: `${label} must be text.` })
    .transform((value) => value.trim())
    .superRefine((value, context) => {
      if (value === "") {
        if (required) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${label} is required.`
          });
        }
        return;
      }

      const result = parsePhoneInput(value, {
        country: defaultCountry,
        label
      });

      if (result.status === "invalid") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: result.message
        });
      }
    })
    .transform((value) => {
      if (value === "") return undefined;

      const result = parsePhoneInput(value, {
        country: defaultCountry,
        label
      });

      // superRefine has already rejected anything else; this narrows the type.
      return result.status === "valid" ? result.value : undefined;
    });
}

/**
 * Formats a stored E.164 number for display, so the UI never shows the raw
 * `+639171234567` back to someone who typed `0917 123 4567`.
 */
export function formatPhoneForDisplay(value: string | null | undefined) {
  if (!value) return "";

  const parsed = parsePhoneNumberFromString(value);

  return parsed?.isValid() ? parsed.formatInternational() : value;
}

/** Progressive formatting as the user types, in that country's own convention. */
export function formatAsYouType(raw: string, country: CountryCode) {
  return new AsYouType(country).input(raw);
}

export type PhoneCountry = {
  code: CountryCode;
  name: string;
  callingCode: string;
};

/**
 * Built once, eagerly, and BEFORE `PHONE_COUNTRIES` below uses it. A `let`
 * initialised lazily further down the file would still be in its temporal dead
 * zone during module evaluation, and every country would silently come out as
 * its own code.
 */
const regionNames = createRegionNames();

function createRegionNames(): Intl.DisplayNames | undefined {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    return undefined;
  }
}

/**
 * Pinned to the top of the picker. These were the four the onboarding form
 * offered before it understood countries at all.
 */
const PRIORITY_COUNTRIES: CountryCode[] = ["US", "GB", "PH", "IN"];

/**
 * Every territory libphonenumber knows, named via `Intl` rather than a
 * hand-kept list that would drift from the metadata.
 */
export const PHONE_COUNTRIES: PhoneCountry[] = buildCountryList();

function buildCountryList(): PhoneCountry[] {
  const all = getCountries().map((code) => ({
    code,
    name: regionName(code),
    callingCode: `+${getCountryCallingCode(code)}`
  }));

  const priority = PRIORITY_COUNTRIES.map((code) =>
    all.find((entry) => entry.code === code)
  ).filter((entry): entry is PhoneCountry => Boolean(entry));

  const rest = all
    .filter((entry) => !PRIORITY_COUNTRIES.includes(entry.code))
    .sort((a, b) => a.name.localeCompare(b.name));

  return [...priority, ...rest];
}

/**
 * One entry from `PHONE_COUNTRIES` by ISO code. A Map rather than a `.find`,
 * because the picker looks this up on every keystroke and the list is 245 long.
 */
export function findPhoneCountry(code: CountryCode): PhoneCountry | undefined {
  return COUNTRY_BY_CODE.get(code);
}

const COUNTRY_BY_CODE = new Map(
  PHONE_COUNTRIES.map((entry) => [entry.code, entry])
);

function regionName(code: CountryCode): string {
  return regionNames?.of(code) ?? code;
}

function lower(label: string) {
  return label.charAt(0).toLowerCase() + label.slice(1);
}

/** Best-effort country for an already-stored number, to seed the picker. */
export function countryFromE164(
  value: string | null | undefined
): CountryCode | undefined {
  if (!value) return undefined;

  return parsePhoneNumberFromString(value)?.country;
}

/** The national part of a stored E.164 number, for the input box. */
export function nationalFromE164(value: string | null | undefined): string {
  if (!value) return "";

  const parsed = parsePhoneNumberFromString(value);

  return parsed?.isValid() ? parsed.formatNational() : value;
}
