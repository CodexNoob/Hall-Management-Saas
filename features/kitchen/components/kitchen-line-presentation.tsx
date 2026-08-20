"use client";

import {
  Badge,
  MenuThumbnail,
  type EventKitchenLine,
  type EventKitchenQuantity
} from "@/features/events/components/event-manager-shared";
import {
  COUNT_BASIS_LABELS,
  type CountBasis
} from "@/features/menu/lib/service-style";

/**
 * How one line of a kitchen sheet is drawn.
 *
 * Shared by the event workspace's Kitchen tab and the board's event dialog. The
 * two ask different questions - "what did we promise, and is it happening"
 * against "what am I cooking next" - but a dish's quantity has to read the same
 * in both, down to the rounding note, or the kitchen has two numbers and trusts
 * neither.
 */

/**
 * Whole where the rule rounds, and only as long as it has to be where it does
 * not - `Exact` rounding is what puts a fraction here at all.
 *
 * Rounded rather than `toFixed`-and-trimmed: trimming the trailing zeros off
 * "0.00" leaves an empty string, and a card reading " trays" is worse than one
 * reading "0 trays".
 */
export function formatUnits(units: number) {
  if (Number.isInteger(units)) return String(units);

  return String(Math.round(units * 100) / 100);
}

export function formatQuantity(quantity: EventKitchenQuantity) {
  const shown = formatUnits(quantity.units);

  // Pluralised off what is printed rather than the float behind it: an `Exact`
  // rule can leave 0.995 units, which shows as "1" and would read "1 plates".
  return `${shown} ${quantity.unit}${shown === "1" ? "" : "s"}`;
}

export function basisLabel(basis: string) {
  return COUNT_BASIS_LABELS[basis as CountBasis] ?? basis.toLowerCase();
}

/**
 * Why a line has no number. Said plainly, because each of the three has a
 * different person to go and ask.
 */
export function countStateNote(line: EventKitchenLine) {
  switch (line.countState) {
    case "Unresolved":
      return line.unresolvedBases.includes("Tables")
        ? "Needs the dining plan"
        : `Needs ${line.unresolvedBases.map(basisLabel).join(", ")}`;
    case "NeedsStyle":
      return "Needs a service style";
    case "NoRule":
      return "No counting rule set";
    default:
      return null;
  }
}

export function LineQuantity({ line }: { line: EventKitchenLine }) {
  const note = countStateNote(line);

  if (line.countState === "NotCounted") {
    return <span className="text-xs text-[#6a7483]">Not cooked to a rule</span>;
  }

  if (note) {
    return <span className="text-xs font-black text-[#9a5b00]">{note}</span>;
  }

  // `raw` is carried so a sheet can explain where its number came from, and a
  // kitchen that cannot see why it got 7 will not trust the 7. Compared as
  // rendered, not as floats: a raw of 6.999 rounded up to 7 would otherwise
  // print "7 before rounding" beside "7 trays" and explain nothing.
  const rounded = line.quantities.filter(
    (quantity) => formatUnits(quantity.raw) !== formatUnits(quantity.units)
  );

  return (
    <span className="block">
      <span className="text-sm font-black text-[#17202a]">
        {line.quantities.map(formatQuantity).join(" + ")}
      </span>
      {rounded.length > 0 ? (
        <span className="mt-0.5 block text-[11px] text-[#6a7483]">
          {rounded
            .map((quantity) => `${formatUnits(quantity.raw)} before rounding`)
            .join(" · ")}
        </span>
      ) : null}
    </span>
  );
}

export function LineStatus({ status }: { status: EventKitchenLine["status"] }) {
  if (status === "COMPLETE") return <Badge tone="green">Complete</Badge>;
  if (status === "PENDING") return <Badge tone="gold">Pending</Badge>;

  return (
    <span className="text-[11px] font-black uppercase tracking-[0.08em] text-[#6a7483]">
      Not started
    </span>
  );
}

export function LineName({ line }: { line: EventKitchenLine }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <MenuThumbnail className="h-9 w-9" pictureUrl={line.pictureUrl} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-black text-[#17202a]">
          {line.name}
        </span>
        {line.notes ? (
          <span className="mt-0.5 block truncate text-xs text-[#6a7483]">
            {line.notes}
          </span>
        ) : null}
        {line.isRetired ? (
          <span className="mt-0.5 block text-[11px] font-black text-[#9a5b00]">
            Retired from the library
          </span>
        ) : null}
      </span>
    </span>
  );
}
