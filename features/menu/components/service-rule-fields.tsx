"use client";

import {
  COUNT_BASES,
  COUNT_BASIS_LABELS,
  COUNTING_UNITS,
  ROUNDING_MODES,
  type ServiceRuleFormValues
} from "@/features/menu/lib/service-style";

/**
 * One counting rule, as a row of controls: `1 tray per 25 guests, round up,
 * min 2`.
 *
 * Lifted out of `NewLibraryItemDialog`, which owned the only copy, because the
 * event menu now asks the same question at a second moment - when a dish that
 * was catalogued without a rule is first put on an event. Two hand-maintained
 * copies of a seven-control row is how the two drift into disagreeing about
 * what a rule may say.
 *
 * Presentational on purpose: it holds no state and does no parsing. The caller
 * keeps `ServiceRuleFormValues` and runs `toServiceRules` when it saves, which
 * is what keeps the validation in one place rather than in each form.
 *
 * `bulk-upload-dialog.tsx` still has its own copy. It offers the superseded
 * preset `<select>` for the unit rather than free text, and converging it
 * changes what that dialog's e2e spec drives - a separate change, not a silent
 * rider on this one.
 */
export function ServiceRuleFields({
  label,
  values,
  onChange,
  unitListId,
  disabled = false
}: {
  /// What the style is called here - "Buffet", "Plated", or "Table" for a
  /// drink. Drives the aria-labels, so it is also how a test finds these.
  label: string;
  values: ServiceRuleFormValues;
  onChange: (patch: Partial<ServiceRuleFormValues>) => void;
  /// The id of a `CountingUnitsDatalist` rendered by the caller. Shared rather
  /// than owned so a form with two of these rows does not put the same eight
  /// options in the DOM twice.
  unitListId: string;
  disabled?: boolean;
}) {
  const controlClass =
    "h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm text-[#17202a] outline-none transition focus:border-[#1f4d73] focus:ring-2 focus:ring-[#1f4d73]/15 disabled:bg-[#f5f6f8] disabled:text-[#6a7483]";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        aria-label={`${label} quantity`}
        className={`${controlClass} w-20`}
        disabled={disabled}
        inputMode="decimal"
        onChange={(event) => onChange({ quantity: event.target.value })}
        required
        value={values.quantity}
      />
      {/* Typed, not picked: the eight presets never covered every kitchen's
          vocabulary, and an operator who counts in pans had to file them under
          the nearest wrong word. The list is still offered, as suggestions the
          field does not enforce. */}
      <input
        aria-label={`${label} unit`}
        className={`${controlClass} w-28`}
        disabled={disabled}
        list={unitListId}
        maxLength={24}
        onChange={(event) => onChange({ unit: event.target.value })}
        required
        value={values.unit}
      />
      <span className="text-xs font-black normal-case text-[#6a7483]">per</span>
      {/* A whole-event rule - one cake, however many guests - divides nothing,
          so the count is not asked for. */}
      {values.perBasis === "Event" ? null : (
        <input
          aria-label={`${label} per quantity`}
          className={`${controlClass} w-20`}
          disabled={disabled}
          inputMode="numeric"
          onChange={(event) => onChange({ per: event.target.value })}
          required
          value={values.per}
        />
      )}
      <select
        aria-label={`${label} per basis`}
        className={`${controlClass} w-32`}
        disabled={disabled}
        onChange={(event) => onChange({ perBasis: event.target.value })}
        value={values.perBasis}
      >
        {COUNT_BASES.map((basis) => (
          <option key={basis} value={basis}>
            {COUNT_BASIS_LABELS[basis]}
          </option>
        ))}
      </select>
      <select
        aria-label={`${label} rounding`}
        className={`${controlClass} w-32`}
        disabled={disabled}
        onChange={(event) => onChange({ rounding: event.target.value })}
        value={values.rounding}
      >
        {ROUNDING_MODES.map((mode) => (
          <option key={mode} value={mode}>
            {mode === "Exact" ? "no rounding" : `round ${mode.toLowerCase()}`}
          </option>
        ))}
      </select>
      <input
        aria-label={`${label} minimum`}
        className={`${controlClass} w-28`}
        disabled={disabled}
        inputMode="numeric"
        onChange={(event) => onChange({ minimumUnits: event.target.value })}
        placeholder="min (opt)"
        value={values.minimumUnits}
      />
    </div>
  );
}

/**
 * The unit suggestions, as a `<datalist>` the rows above point at by id.
 *
 * Separate from the row so one list can serve several: the library dialog has a
 * row per service style, and the event menu's band has one per dish waiting on
 * a rule.
 */
export function CountingUnitsDatalist({ id }: { id: string }) {
  return (
    <datalist id={id}>
      {COUNTING_UNITS.map((unit) => (
        <option key={unit} value={unit} />
      ))}
    </datalist>
  );
}
