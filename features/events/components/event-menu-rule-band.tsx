"use client";

import { useId, useState } from "react";
import { useDashboardPermission } from "@/features/dashboard/hooks/use-dashboard-permission";
import {
  MenuThumbnail,
  type EventMenuLine,
  type EventMenuResponse
} from "@/features/events/components/event-manager-shared";
import {
  CountingUnitsDatalist,
  ServiceRuleFields
} from "@/features/menu/components/service-rule-fields";
import {
  readServiceRules,
  readServiceStyleFormValues,
  serviceFormDefaults,
  serviceStyleLabel,
  SERVICE_STYLES,
  toServiceRules,
  type ServiceRuleFormValues,
  type ServiceStyle
} from "@/features/menu/lib/service-style";
import { updateMenuItem } from "@/features/menu/services/menu-items";

type CatalogItem = EventMenuResponse["items"][number];

/**
 * The dishes on this menu whose style carries no counting rule.
 *
 * A dish may be catalogued without one - "served" and "counted" are separate
 * answers, and asking for the arithmetic while someone is still naming a dish
 * is what made operators guess. The question is put here instead, at the first
 * moment it decides something: this event is serving the dish, so the kitchen
 * is about to need a number.
 *
 * Same predicate the kitchen sheet reaches `countState: "NoRule"` by, so the
 * two views cannot disagree about which dishes are waiting.
 */
export function rulelessLines(lines: EventMenuLine[]) {
  return lines.filter(
    (line) =>
      line.kind === "Dish" &&
      line.serviceStyle !== null &&
      !line.availableStyles.includes(line.serviceStyle)
  );
}

/** The line's style, narrowed. `rulelessLines` guarantees it is one of these. */
function styleOf(line: EventMenuLine): ServiceStyle | null {
  return (
    SERVICE_STYLES.find((candidate) => candidate === line.serviceStyle) ?? null
  );
}

/**
 * Asks for the missing rules and writes them back to the LIBRARY, not to the
 * line.
 *
 * That is the whole point of answering here rather than storing a per-event
 * rate: "one tray per twenty-five guests" is a fact about the dish and the
 * kitchen's practice, the same at every event. Answering it once on the event
 * that first needed it is convenience; storing it per event would be a promise
 * to re-type it forever and to let the same dish drift to different rates on
 * different weddings.
 *
 * Deliberately does not block confirmation. A menu confirmed with a rule still
 * missing is legible downstream - the sheet prints "No counting rule set"
 * against that dish - which is the same latitude the "needs a service style"
 * band above it already allows.
 */
export function EventMenuRuleBand({
  lines,
  catalog,
  disabled,
  onSaved
}: {
  /// Already filtered by `rulelessLines`.
  lines: EventMenuLine[];
  /// `/api/menu` items, for the dish's kind and the rules it already carries.
  catalog: CatalogItem[];
  disabled: boolean;
  /// Re-reads the menu so a line whose rule just landed leaves this band.
  onSaved: () => Promise<unknown>;
}) {
  const unitListId = useId();
  // Writing a rule is a library edit, which is a different permission from the
  // one that lets someone edit this event's menu. Every stock role holds both
  // or neither, so this only bites a hand-tuned grant - but it bites as a 403
  // from a form that looked writable, so the form is not offered at all.
  const canEditMenu = useDashboardPermission("menu.update");
  // Keyed by line id, seeded lazily from the dish's kind. Untouched lines are
  // absent rather than pre-filled, so `seed` below stays the single source of
  // what an unanswered row shows.
  const [drafts, setDrafts] = useState<Record<string, ServiceRuleFormValues>>(
    {}
  );
  const [savingLineId, setSavingLineId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (lines.length === 0) return null;

  const itemFor = (line: EventMenuLine) =>
    catalog.find((item) => item.id === line.menuItemId) ?? null;

  /// Falls back to Food when the catalog has not arrived, which only costs a
  /// drink the bottles-per-table defaults for as long as that request is out.
  const kindFor = (line: EventMenuLine) => itemFor(line)?.kind ?? "Food";

  const seed = (line: EventMenuLine, style: ServiceStyle) =>
    drafts[line.id] ?? serviceFormDefaults(kindFor(line))[style];

  const update = (line: EventMenuLine, patch: Partial<ServiceRuleFormValues>) => {
    const style = styleOf(line);
    if (!style) return;

    const current = seed(line, style);

    setDrafts((existing) => ({
      ...existing,
      [line.id]: { ...current, ...patch }
    }));
  };

  const save = async (line: EventMenuLine) => {
    const style = styleOf(line);
    const item = itemFor(line);

    if (!style || !item || !line.menuItemId) return;

    setError(null);
    setSavingLineId(line.id);

    try {
      // Seeded from what the dish already carries, then this one style is
      // switched on over the top. `services` REPLACES the stored set, so a dish
      // that is already plated would lose that rule if only the new one were
      // sent.
      const existing = readServiceRules(item.services);

      // `readServiceRules` degrades to "no rule" on anything it cannot parse,
      // which is the right answer while RENDERING - a card missing a line beats
      // a card that throws. On a write it is the wrong one: the parsed set is
      // what gets sent back, so degrading here would delete the rules it failed
      // to read. Refuse instead, and say which dish to go and look at.
      if (existing.length !== item.services.length) {
        throw new Error(
          `${item.name} has a counting rule this page cannot read. Open it in the menu library before setting another.`
        );
      }

      const values = readServiceStyleFormValues(existing, item.kind);

      // Throws for the catch below rather than coercing - the same contract the
      // library dialog's save runs under, and the reason a blank unit cannot
      // reach the database as an empty string.
      const services = toServiceRules({
        ...values,
        [style]: { ...seed(line, style), enabled: true }
      });

      await updateMenuItem(line.menuItemId, { services });
      await onSaved();

      // Only after the server has taken it. Dropping the draft on the way out
      // would blank the row while the write was still in the air.
      setDrafts((existing) => {
        const rest = { ...existing };
        delete rest[line.id];

        return rest;
      });
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "The counting rule could not be saved. Please try again."
      );
    } finally {
      setSavingLineId(null);
    }
  };

  return (
    <section className="border-b border-[#f0d9a8] bg-[#fdf8ec] px-3 py-3 sm:px-4">
      <h3 className="text-xs font-black uppercase tracking-wide text-[#8a6414]">
        Needs a counting rule
      </h3>
      <p className="mt-1 text-xs text-[#6a7483]">
        {canEditMenu
          ? "These dishes have no rule for the way they are served here, so the kitchen has no quantity to cook to. The answer is saved to the menu library and used by every event."
          : "These dishes have no rule for the way they are served here, so the kitchen has no quantity to cook to. Setting one is a menu library change, which your access does not cover."}
      </p>

      {error ? (
        <p
          className="mt-2 rounded-lg border border-[#efb5ad] bg-white px-3 py-2 text-xs font-bold text-[#c3291b]"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <ul className="mt-2 space-y-2">
        {lines.map((line) => {
          const style = styleOf(line);

          if (!style) return null;

          const label = serviceStyleLabel(style, kindFor(line));
          const isSaving = savingLineId === line.id;

          return (
            <li
              className="rounded-lg border border-[#e6dcc2] bg-white px-3 py-2"
              key={line.id}
            >
              <span className="flex min-w-0 items-center gap-2">
                <MenuThumbnail className="h-9 w-9" pictureUrl={line.pictureUrl} />
                <span className="truncate text-sm font-black text-[#17202a]">
                  {line.name}
                </span>
                <span className="shrink-0 rounded-full border border-[#cfe0ee] bg-[#eef4fa] px-2 py-0.5 text-[10px] font-black text-[#173b58]">
                  {label}
                </span>
              </span>

              {canEditMenu ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <ServiceRuleFields
                    disabled={disabled || isSaving}
                    label={label}
                    onChange={(patch) => update(line, patch)}
                    unitListId={unitListId}
                    values={seed(line, style)}
                  />
                  <button
                    className="h-9 shrink-0 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white transition hover:bg-[#15344f] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={disabled || isSaving}
                    onClick={() => void save(line)}
                    type="button"
                  >
                    {isSaving ? "Saving..." : "Save rule"}
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {canEditMenu ? <CountingUnitsDatalist id={unitListId} /> : null}
    </section>
  );
}
