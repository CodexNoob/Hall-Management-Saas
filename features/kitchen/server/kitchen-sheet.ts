import type { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  visibleKitchenLines,
  WHOLE_KITCHEN,
  type KitchenVisibility
} from "@/features/kitchen/server/kitchen-visibility";
import {
  calculateStyleQuantity,
  readLineMultiplier,
  scaleMenuQuantities,
  totalGuests,
  type EventHeadCounts
} from "@/features/menu/lib/menu-quantity";
import {
  readServiceRules,
  SERVICE_STYLES
} from "@/features/menu/lib/service-style";
import {
  isDiningSeatingTable,
  validTables
} from "@/features/dining/components/dining-shared";

/**
 * What a kitchen has to cook for one event, and how far along it is.
 *
 * Extracted from `GET /api/events/[eventId]/kitchen`, which used to be its only
 * caller. The board at `GET /api/kitchen` now runs the same computation over a
 * four week window, and the one thing the two views must never do is disagree:
 * an event's card saying "6 of 14 done" while its own kitchen tab says something
 * else is worse than either number being absent. Sharing the code is what makes
 * that impossible rather than merely unlikely.
 *
 * Pure, and deliberately no `server-only`: it takes rows and returns a sheet, so
 * it can be tested without a database. Prisma appears only as types, which are
 * erased - the caller does the querying.
 */

export const MEALS = [
  "Main",
  "FridayNight",
  "ShabbosDay",
  "SeudahShlishis"
] as const;

export const mealSchema = z.enum(MEALS).default("Main");

/**
 * The meal the kitchen board reads.
 *
 * A Shabbos booking is genuinely three or four cooking jobs, and the schema is
 * keyed `(eventId, meal)` to hold them - but nothing in the UI selects a meal
 * yet, so every menu written so far is a `Main`. Named rather than inlined so
 * the board's eventual meal picker has one place to replace.
 */
export const DEFAULT_MEAL = "Main";

export const eventSelect = {
  id: true,
  hallId: true,
  couplesCount: true,
  menCount: true,
  ladiesCount: true,
  boysCount: true,
  girlsCount: true,
  kidsCount: true,
  waitersCount: true,
  /// The only table data there is. `Event` has no table column, which is why a
  /// per-table rule on an event with no plan is reported unresolved rather than
  /// cooked as zero.
  diningPlan: { select: { tables: true } }
} satisfies Prisma.EventSelect;

export const lineOrder = [
  { sortOrder: "asc" },
  { createdAt: "asc" }
] satisfies Prisma.EventMenuLineOrderByWithRelationInput[];

export const kitchenLineSelect = {
  id: true,
  menuItemId: true,
  addOnId: true,
  itemName: true,
  serviceStyle: true,
  notes: true,
  sortOrder: true,
  // Without this the sheet still typechecks and still renders - at 1x, for every
  // line, forever. There is no failing symptom to notice, which is why the route
  // test asserts a doubled line end to end rather than trusting the select.
  quantityMultiplier: true,
  menuItem: {
    select: {
      name: true,
      // Food or Drink. The sheet groups on it so bottles are not filed among
      // the trays: a drink carries a Buffet or Plated rule like anything else,
      // which is exactly why the style alone cannot tell them apart.
      kind: true,
      isActive: true,
      // Signed by the caller and handed over as a URL. The bucket is never
      // selected and the path never reaches the client, the same rule the menu
      // route follows.
      picturePath: true,
      services: {
        select: {
          serviceStyle: true,
          quantity: true,
          unit: true,
          per: true,
          perBasis: true,
          rounding: true,
          minimumUnits: true
        },
        orderBy: { serviceStyle: "asc" }
      }
    }
  },
  // No price: a production sheet has no use for money.
  addOn: { select: { name: true, isActive: true, picturePath: true } }
} satisfies Prisma.EventMenuLineSelect;

export const kitchenMenuSelect = {
  meal: true,
  status: true,
  confirmedAt: true,
  version: true,
  lines: { select: kitchenLineSelect, orderBy: lineOrder }
} satisfies Prisma.EventMenuSelect;

export const statusSelect = {
  menuItemId: true,
  status: true,
  // The id as well as the name. Matching a worker by name was ambiguous the
  // moment two of them could share one - which the roster screen now makes
  // possible in spirit, even with the unique index holding it off in practice.
  assignedWorkerId: true,
  assignedWorker: { select: { name: true } }
} satisfies Prisma.KitchenItemStatusSelect;

/**
 * The board needs the same statuses keyed by event, so it selects `eventId` too.
 * Kept as a separate constant rather than adding the column to `statusSelect`:
 * the per-event route already knows which event it asked about, and a field it
 * never reads would just be noise in its payload.
 */
export const boardStatusSelect = {
  ...statusSelect,
  eventId: true
} satisfies Prisma.KitchenItemStatusSelect;

export type KitchenEventRow = Prisma.EventGetPayload<{
  select: typeof eventSelect;
}>;

export type KitchenMenuRow = Prisma.EventMenuGetPayload<{
  select: typeof kitchenMenuSelect;
}>;

export type KitchenLineRow = Prisma.EventMenuLineGetPayload<{
  select: typeof kitchenLineSelect;
}>;

export type StatusRow = Prisma.KitchenItemStatusGetPayload<{
  select: typeof statusSelect;
}>;

/**
 * `null` for tables, never 0: an event nobody has drawn a seating plan for
 * genuinely cannot answer a per-table rule, and a sheet printing "0 dips"
 * because of it is worse than one saying it cannot work the number out.
 *
 * A plan row that exists but holds no seating tables is the same "cannot
 * answer", not an answer of zero - the dining page saves a plan as soon as
 * anyone edits the counts beside it, long before a table is drawn, and the
 * column defaults to `[]`.
 */
export function readHeadCounts(event: KitchenEventRow): EventHeadCounts {
  const plan = event.diningPlan;
  const seatingTables = plan
    ? validTables(plan.tables).filter(isDiningSeatingTable).length
    : 0;

  return {
    couples: event.couplesCount,
    men: event.menCount,
    ladies: event.ladiesCount,
    boys: event.boysCount,
    girls: event.girlsCount,
    kids: event.kidsCount,
    waiters: event.waitersCount,
    tables: seatingTables > 0 ? seatingTables : null
  };
}

/**
 * One line of the sheet.
 *
 * The name follows the same rule as the menu tab: a confirmed line answers from
 * its own snapshot, a draft answers from the library, so a rename reaches a menu
 * nobody has signed off and never changes one the kitchen already read.
 */
export function presentKitchenLine(
  line: KitchenLineRow,
  pictureUrl: string | null,
  counts: EventHeadCounts,
  itemStatus: StatusRow | undefined
) {
  const isAddOn = line.addOnId !== null;
  const services = line.menuItem?.services ?? [];
  // `quantity` is a Prisma Decimal; the rule schema wants a number. Converting
  // at the boundary is the same call GET /api/menu makes.
  const rules = readServiceRules(
    services.map((service) => ({
      ...service,
      quantity: Number(service.quantity)
    }))
  );
  const availableStyles = [
    ...new Set(services.map((service) => service.serviceStyle))
  ];
  const style =
    SERVICE_STYLES.find((candidate) => candidate === line.serviceStyle) ?? null;
  // `null` means "this dish is not served that way", which is different from a
  // dish served that way whose arithmetic came out at zero.
  const result = style ? calculateStyleQuantity(rules, style, counts) : null;
  // "2x the brisket". Applied to the finished units rather than to the head
  // counts, so each serving clears the rule's minimum on its own.
  const quantityMultiplier = readLineMultiplier(line.quantityMultiplier);

  const countState = isAddOn
    ? ("NotCounted" as const)
    : result && result.quantities.length > 0
      ? ("Counted" as const)
      : result && result.unresolved.length > 0
        ? ("Unresolved" as const)
        : !style && availableStyles.length > 0
          ? ("NeedsStyle" as const)
          : ("NoRule" as const);

  return {
    id: line.id,
    menuItemId: line.menuItemId,
    addOnId: line.addOnId,
    kind: isAddOn ? ("AddOn" as const) : ("Dish" as const),
    itemKind: line.menuItem?.kind ?? null,
    name: line.itemName ?? line.menuItem?.name ?? line.addOn?.name ?? "",
    pictureUrl,
    serviceStyle: line.serviceStyle,
    availableStyles,
    notes: line.notes,
    sortOrder: line.sortOrder,
    isRetired: isAddOn
      ? line.addOn?.isActive === false
      : line.menuItem?.isActive === false,
    // Multiplied here rather than at the point it is drawn: a doubled line that
    // reaches a screen which has not heard of multipliers must still say 14, not
    // 7. Under-cooking is the failure worth designing against.
    quantityMultiplier,
    quantities: scaleMenuQuantities(
      result?.quantities ?? [],
      quantityMultiplier
    ),
    unresolvedBases: result?.unresolved ?? [],
    countState,
    // Null and "no row at all" are the same answer - not started - which is why
    // this tests the value rather than the row's existence: a row that exists
    // only to record who is on a dish must not read as work already begun.
    //
    // Beyond that, the persisted vocabulary is PENDING and COMPLETE, guarded
    // only by a zod enum on the board's PATCH - so anything else that reached
    // the column is read as "started but not finished" rather than trusted
    // through.
    status:
      itemStatus?.status == null
        ? null
        : itemStatus.status === "COMPLETE"
          ? ("COMPLETE" as const)
          : ("PENDING" as const),
    assignedWorkerId: itemStatus?.assignedWorkerId ?? null,
    assignedWorkerName: itemStatus?.assignedWorker?.name ?? null
  };
}

export function summarize(
  lines: ReturnType<typeof presentKitchenLine>[],
  currentWorkerId?: string | null
) {
  const dishes = lines.filter((line) => line.kind === "Dish");

  return {
    dishes: dishes.length,
    addOns: lines.length - dishes.length,
    complete: dishes.filter((line) => line.status === "COMPLETE").length,
    pending: dishes.filter((line) => line.status === "PENDING").length,
    notStarted: dishes.filter((line) => line.status === null).length,
    assigned: dishes.filter((line) => Boolean(line.assignedWorkerId)).length,
    assignedToCurrentWorker: currentWorkerId
      ? dishes.filter((line) => line.assignedWorkerId === currentWorkerId)
          .length
      : 0,
    // Every dish the kitchen has no number to cook to. One count, because the
    // three causes want the same action: someone has to go and say.
    needsAttention: dishes.filter((line) =>
      ["NeedsStyle", "NoRule", "Unresolved"].includes(line.countState)
    ).length,
    unresolvedBases: [...new Set(lines.flatMap((line) => line.unresolvedBases))]
  };
}

/**
 * The whole sheet for one event.
 *
 * `signedUrlsByPath` is optional because summary-only callers do not need
 * storage URLs. Absent, every line answers `pictureUrl: null`.
 */
export function buildKitchenSheet({
  event,
  meal,
  menu,
  otherMeals = [],
  statuses,
  currentWorkerId,
  visibility = WHOLE_KITCHEN,
  signedUrlsByPath
}: {
  event: KitchenEventRow;
  meal: string;
  menu: KitchenMenuRow | null;
  /// The event's other `EventMenu` rows - the meals this sheet is not showing.
  /// Passed in rather than derived: the sheet takes rows and returns a sheet,
  /// and only the caller can query.
  otherMeals?: string[];
  statuses: StatusRow[];
  currentWorkerId?: string | null;
  /// How much of this sheet the caller may be sent. Applied here rather than at
  /// each call site so `counts`, `lines` and `summary` can never disagree about
  /// which lines exist: a summary counted over ten dishes beside a list of the
  /// three that were sent is how a restriction becomes a leak of the other
  /// seven. Defaults to the whole sheet, so every non-kitchen caller is
  /// unchanged.
  visibility?: KitchenVisibility;
  signedUrlsByPath?: Map<string, string>;
}) {
  const counts = readHeadCounts(event);
  // Keyed by menu item, because that is how KitchenItemStatus is uniquely
  // keyed. An add-on line can therefore never carry a status.
  const statusByMenuItemId = new Map(
    statuses.map((itemStatus) => [itemStatus.menuItemId, itemStatus])
  );

  const lines = visibleKitchenLines(
    (menu?.lines ?? []).map((line) => {
      const picturePath =
        line.menuItem?.picturePath ?? line.addOn?.picturePath ?? null;

      return presentKitchenLine(
        line,
        picturePath ? (signedUrlsByPath?.get(picturePath) ?? null) : null,
        counts,
        line.menuItemId ? statusByMenuItemId.get(line.menuItemId) : undefined
      );
    }),
    visibility
  );

  return {
    meal,
    // Every read path in the kitchen shows one meal, and until a meal picker
    // exists that meal is always `Main`. Carrying the ones it is not showing is
    // what stops three quarters of a Shabbos event's cooking going missing with
    // no error and no empty state: the surfaces cannot draw those meals yet,
    // but they can say they exist.
    otherMeals,
    // No row until the first save, answered as an empty draft rather than a
    // 404 - the same shape the menu route's emptyMenu returns.
    menuStatus: menu?.status ?? "Draft",
    confirmedAt: menu?.confirmedAt ?? null,
    version: menu?.version ?? 0,
    counts: { ...counts, totalGuests: totalGuests(counts) },
    lines,
    summary: summarize(lines, currentWorkerId)
  };
}

/**
 * Every picture path on a set of lines, deduplicated, for one signing request.
 *
 * Lives here rather than in the route so the board can reuse it the day it
 * decides it wants thumbnails; the signing call itself stays with the caller,
 * which is the piece that needs storage and an organization id.
 */
export function collectPicturePaths(lines: KitchenLineRow[]) {
  return [
    ...new Set(
      lines
        .map((line) => line.menuItem?.picturePath ?? line.addOn?.picturePath)
        .filter((path): path is string => Boolean(path))
    )
  ];
}
