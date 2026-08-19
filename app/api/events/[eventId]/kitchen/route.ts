import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isDiningSeatingTable,
  validTables
} from "@/features/dining/components/dining-shared";
import {
  calculateStyleQuantity,
  totalGuests,
  type EventHeadCounts
} from "@/features/menu/lib/menu-quantity";
import {
  readServiceRules,
  SERVICE_STYLES
} from "@/features/menu/lib/service-style";
import { assertHallAccess, requireAnyPermission } from "@/lib/auth/server-auth";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import { MENU_IMAGE_BUCKET } from "@/lib/storage/buckets";
import { createSignedFileUrls } from "@/lib/storage/files";

/**
 * What the kitchen has to cook for one event, and how far along it is.
 *
 * Read-only, and deliberately a second route rather than more fields on
 * `GET /api/events/[eventId]/menu`: the menu tab needs style *names* to offer a
 * choice, while this needs the whole `MenuItemService` rule to run the
 * arithmetic, plus the kitchen statuses the menu tab has no use for.
 *
 * The numbers are worked out here rather than in the panel because the counts
 * they divide do not exist on the client: `EventFile` collapses the seven head
 * counts into display strings, and the table count lives in `DiningPlan.tables`,
 * which is server-side json.
 *
 * Reads `EventMenuLine`, not the `Event.menuItemIds` mirror the kitchen
 * dashboard still reads. The array cannot say which way a dish is served at this
 * event, and that choice is what decides which rule runs - so it cannot answer
 * the only question this route exists to answer. One consequence to know about:
 * `replace-menu-item` and `remove-menu-item` on the kitchen board write only the
 * mirror, so a board edit will not show here until those writers move across.
 */

const MEALS = ["Main", "FridayNight", "ShabbosDay", "SeudahShlishis"] as const;

const mealSchema = z.enum(MEALS).default("Main");
const eventIdSchema = z.string().uuid();

const eventSelect = {
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

const lineOrder = [
  { sortOrder: "asc" },
  { createdAt: "asc" }
] satisfies Prisma.EventMenuLineOrderByWithRelationInput[];

const kitchenLineSelect = {
  id: true,
  menuItemId: true,
  addOnId: true,
  itemName: true,
  serviceStyle: true,
  notes: true,
  sortOrder: true,
  menuItem: {
    select: {
      name: true,
      isActive: true,
      // Signed below and handed over as a URL. The bucket is never selected and
      // the path never reaches the client, the same rule the menu route follows.
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

const kitchenMenuSelect = {
  meal: true,
  status: true,
  confirmedAt: true,
  version: true,
  lines: { select: kitchenLineSelect, orderBy: lineOrder }
} satisfies Prisma.EventMenuSelect;

const statusSelect = {
  menuItemId: true,
  status: true,
  assignedWorker: { select: { name: true } }
} satisfies Prisma.KitchenItemStatusSelect;

type KitchenLineRow = Prisma.EventMenuLineGetPayload<{
  select: typeof kitchenLineSelect;
}>;

type StatusRow = Prisma.KitchenItemStatusGetPayload<{
  select: typeof statusSelect;
}>;

async function loadEvent(actor: { organizationId: string }, eventId: string) {
  return prisma.event.findFirst({
    where: {
      id: eventId,
      organizationId: actor.organizationId,
      deleted: false
    },
    select: eventSelect
  });
}

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
function readHeadCounts(
  event: Prisma.EventGetPayload<{ select: typeof eventSelect }>
): EventHeadCounts {
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
function presentKitchenLine(
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
    name: line.itemName ?? line.menuItem?.name ?? line.addOn?.name ?? "",
    pictureUrl,
    serviceStyle: line.serviceStyle,
    availableStyles,
    notes: line.notes,
    sortOrder: line.sortOrder,
    isRetired: isAddOn
      ? line.addOn?.isActive === false
      : line.menuItem?.isActive === false,
    quantities: (result?.quantities ?? []).map((quantity) => ({
      unit: quantity.unit,
      units: quantity.units,
      raw: quantity.raw
    })),
    unresolvedBases: result?.unresolved ?? [],
    countState,
    // The persisted vocabulary is PENDING and COMPLETE, guarded only by a zod
    // enum on the board's PATCH - so anything else that reached the column is
    // read as "started but not finished" rather than trusted through.
    status: itemStatus
      ? itemStatus.status === "COMPLETE"
        ? ("COMPLETE" as const)
        : ("PENDING" as const)
      : null,
    assignedWorkerName: itemStatus?.assignedWorker?.name ?? null
  };
}

/**
 * One signing request for the whole sheet rather than one per row, copying what
 * the menu route does. The 300s default outlives the 2 minute client query
 * cache, so a cached response never holds an expired URL, and storage being
 * unreachable costs the thumbnails rather than the sheet.
 */
async function signLinePictures(
  lines: KitchenLineRow[],
  organizationId: string
) {
  const picturePaths = lines
    .map((line) => line.menuItem?.picturePath ?? line.addOn?.picturePath)
    .filter((path): path is string => Boolean(path));

  if (picturePaths.length === 0) return new Map<string, string>();

  try {
    return await createSignedFileUrls({
      organizationId,
      bucket: MENU_IMAGE_BUCKET,
      paths: [...new Set(picturePaths)]
    });
  } catch (signingError) {
    console.error("Failed to sign event kitchen pictures", signingError);

    return new Map<string, string>();
  }
}

function summarize(lines: ReturnType<typeof presentKitchenLine>[]) {
  const dishes = lines.filter((line) => line.kind === "Dish");

  return {
    dishes: dishes.length,
    addOns: lines.length - dishes.length,
    complete: dishes.filter((line) => line.status === "COMPLETE").length,
    pending: dishes.filter((line) => line.status === "PENDING").length,
    notStarted: dishes.filter((line) => line.status === null).length,
    // Every dish the kitchen has no number to cook to. One count, because the
    // three causes want the same action: someone has to go and say.
    needsAttention: dishes.filter((line) =>
      ["NeedsStyle", "NoRule", "Unresolved"].includes(line.countState)
    ).length,
    unresolvedBases: [...new Set(lines.flatMap((line) => line.unresolvedBases))]
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    // The same pair the menu tab's GET requires. Not canViewKitchenDashboard:
    // this reads one event's own menu from inside the event workspace, and
    // demanding the board permission would 403 a manager who can already see
    // and edit these dishes one tab across.
    const actor = await requireAnyPermission(request, [
      "canViewEventManager",
      "canViewCalendar"
    ]);
    const { eventId } = await params;
    const id = eventIdSchema.parse(eventId);
    const meal = mealSchema.parse(
      new URL(request.url).searchParams.get("meal") ?? undefined
    );

    const event = await loadEvent(actor, id);

    if (!event) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    assertHallAccess(actor, event.hallId);

    const [menu, statuses] = await Promise.all([
      prisma.eventMenu.findUnique({
        where: { eventId_meal: { eventId: id, meal } },
        select: kitchenMenuSelect
      }),
      prisma.kitchenItemStatus.findMany({
        where: { eventId: id, organizationId: actor.organizationId },
        select: statusSelect
      })
    ]);

    const counts = readHeadCounts(event);
    const storedLines = menu?.lines ?? [];
    const signedUrlsByPath = await signLinePictures(
      storedLines,
      actor.organizationId
    );
    // Keyed by menu item, because that is how KitchenItemStatus is uniquely
    // keyed. An add-on line can therefore never carry a status.
    const statusByMenuItemId = new Map(
      statuses.map((itemStatus) => [itemStatus.menuItemId, itemStatus])
    );

    const lines = storedLines.map((line) => {
      const picturePath =
        line.menuItem?.picturePath ?? line.addOn?.picturePath ?? null;

      return presentKitchenLine(
        line,
        picturePath ? (signedUrlsByPath.get(picturePath) ?? null) : null,
        counts,
        line.menuItemId ? statusByMenuItemId.get(line.menuItemId) : undefined
      );
    });

    return NextResponse.json({
      kitchen: {
        meal,
        // No row until the first save, answered as an empty draft rather than a
        // 404 - the same shape the menu route's emptyMenu returns.
        menuStatus: menu?.status ?? "Draft",
        confirmedAt: menu?.confirmedAt ?? null,
        version: menu?.version ?? 0,
        counts: { ...counts, totalGuests: totalGuests(counts) },
        lines,
        summary: summarize(lines)
      }
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
