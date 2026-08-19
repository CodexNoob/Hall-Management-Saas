import type { SeatingSides } from "@/lib/hall-map/seating";

export type TableSide = "men" | "women" | "kids" | "head";

export const DINING_MAP_WORLD_SIZE = 20_000;
export const DINING_MAP_WORLD_ORIGIN = DINING_MAP_WORLD_SIZE / 2;
export const DINING_MAP_MIN_SCALE = 0.05;
export const DINING_MAP_MAX_SCALE = 2;

export type DiningTableData = {
  id: string;
  number: number;
  name?: string;
  seats: number;
  side: TableSide;
  isSeating?: boolean;
  mapObjectId?: string;
  mapType?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  /**
   * Carried over from the hall map object so the Dining Manager draws the same
   * chairs the editor did. Absent on presets saved before seating existed.
   */
  seatingSides?: SeatingSides;
};

export type DiningPlan = {
  id: string;
  eventId: string;
  hallMapPresetId: string | null;
  countType: "People" | "Couples";
  adultCount: number;
  childrenCount: number;
  menWaiters: number;
  womenWaiters: number;
  tablecloth: string | null;
  washingTime: string | null;
  specialNotes: string | null;
  tables: unknown;
};

export type HallMapObject = {
  id: string;
  type: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  seats: number;
  seatingUse: "none" | "adult" | "kids" | "head";
  seatingSides?: SeatingSides;
};

export type HallMapPreset = {
  id: string;
  hallId: string;
  name: string;
  objects: unknown;
};

export type DiningEvent = {
  id: string;
  clientName: string;
  eventType: string | null;
  eventDate: string;
  startsAt: string | null;
  eventStatus: string;
  bookingStatus: string;
  packageName: string | null;
  couplesCount: number;
  menCount: number;
  ladiesCount: number;
  boysCount: number;
  girlsCount: number;
  kidsCount: number;
  waitersCount: number;
  tableclothName: string | null;
  washingTime: string | null;
  notes: string | null;
  hall: { id: string; name: string };
  diningPlan: DiningPlan | null;
};

export type DiningResponse = {
  events: DiningEvent[];
  hallMapPresets: HallMapPreset[];
};

export type DiningPlanPayload = {
  eventId: string;
  hallMapPresetId?: string | null;
  countType: "People" | "Couples";
  adultCount: number;
  childrenCount: number;
  menWaiters: number;
  womenWaiters: number;
  tablecloth?: string;
  washingTime?: string;
  specialNotes?: string;
  tables: DiningTableData[];
};

export type DiningForm = Omit<DiningPlanPayload, "eventId" | "tables">;

export const tableclothOptions = ["Ivory", "White", "Champagne", "Black"];

export function validTables(value: unknown): DiningTableData[] {
  if (!Array.isArray(value)) return [];
  return value.filter((table): table is DiningTableData =>
    Boolean(
      table &&
      typeof table === "object" &&
      "id" in table &&
      "number" in table &&
      "seats" in table &&
      "side" in table
    )
  );
}

export function isDiningSeatingTable(table: DiningTableData) {
  return table.isSeating !== false && table.seats > 0;
}

/**
 * How the adults split between the men's and women's sides.
 *
 * Derived from the booking rather than assumed. This used to be a flat
 * `ceil(adults / 2)`, which meant a 60/40 event and a 40/60 event produced
 * identical seating - the counts the client actually gave were on the event
 * all along. Couples contribute one seat to each side.
 *
 * The ratio, not the raw numbers, is applied to `adultCount`: the dining form
 * lets a planner adjust the head count, and that edit has to keep working
 * without silently reverting to the booked figure.
 */
export function diningGenderSplit(
  event: Pick<DiningEvent, "couplesCount" | "menCount" | "ladiesCount"> | null,
  adultCount: number
) {
  const evenSplit = () => {
    const menRequired = Math.ceil(adultCount / 2);
    return { menRequired, womenRequired: adultCount - menRequired };
  };

  if (!event) return evenSplit();

  const eventMen = event.couplesCount + event.menCount;
  const eventWomen = event.couplesCount + event.ladiesCount;
  const eventAdults = eventMen + eventWomen;

  // No gender breakdown recorded - an older booking, or counts left at zero.
  if (eventAdults <= 0) return evenSplit();

  const menRequired = Math.min(
    adultCount,
    Math.round((adultCount * eventMen) / eventAdults)
  );

  return { menRequired, womenRequired: adultCount - menRequired };
}

export const DEFAULT_SEATS_PER_TABLE = 10;
export const MIN_SEATS_PER_TABLE = 1;
export const MAX_SEATS_PER_TABLE = 30;

/**
 * How many seats a table holds at this venue, read back from the layout.
 *
 * Deliberately derived rather than stored. The tables already carry their own
 * `seats`, so a separate saved figure would be a second source of truth free to
 * disagree with the layout it describes - and the honest answer to "what is a
 * table here" is whatever most of the tables actually are.
 *
 * Head tables are excluded: they are a different piece of furniture (12 by
 * default) and there is usually exactly one, so counting it would drag the
 * figure away from the round tables the requirement maths is about.
 */
export function deriveSeatsPerTable(tables: DiningTableData[]) {
  const frequency = new Map<number, number>();

  for (const table of tables) {
    if (!isDiningSeatingTable(table) || table.side === "head") continue;
    frequency.set(table.seats, (frequency.get(table.seats) ?? 0) + 1);
  }

  let seatsPerTable = DEFAULT_SEATS_PER_TABLE;
  let highestCount = 0;

  for (const [seats, count] of frequency) {
    // A tie goes to the larger table. Rounding capacity down would inflate the
    // table requirement, which is the safer error only until it stops fitting
    // in the room.
    if (count > highestCount || (count === highestCount && seats > seatsPerTable)) {
      seatsPerTable = seats;
      highestCount = count;
    }
  }

  return seatsPerTable;
}

export function clampSeatsPerTable(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_SEATS_PER_TABLE;
  return Math.min(
    MAX_SEATS_PER_TABLE,
    Math.max(MIN_SEATS_PER_TABLE, Math.round(value))
  );
}

export function diningTableRequirements(input: {
  childrenCount: number;
  menRequired: number;
  womenRequired: number;
  tableCapacity?: number;
}) {
  const tableCapacity = Math.max(
    1,
    input.tableCapacity ?? DEFAULT_SEATS_PER_TABLE
  );

  return {
    kids: Math.ceil(input.childrenCount / tableCapacity),
    men: Math.ceil(input.menRequired / tableCapacity),
    women: Math.ceil(input.womenRequired / tableCapacity)
  };
}

export function diningTableSignature(tables: DiningTableData[]) {
  const seatingTables = tables.filter(isDiningSeatingTable);

  return {
    kids: seatingTables.filter((table) => table.side === "kids").length,
    men: seatingTables.filter((table) => table.side === "men").length,
    women: seatingTables.filter((table) => table.side === "women").length
  };
}

function daysApart(left: string, right: string) {
  const difference = Date.parse(left) - Date.parse(right);
  return Number.isFinite(difference)
    ? Math.abs(difference) / 86_400_000
    : Number.POSITIVE_INFINITY;
}

/**
 * The best saved layout to reuse for an event, or null.
 *
 * Two rules beyond matching the required table counts:
 *
 * - **Same hall only.** Table coordinates are meaningless in a room of a
 *   different shape, and this previously reused a layout from any hall whose
 *   table counts happened to line up.
 * - **Ranked, not first-found.** Candidates are ordered by how close their
 *   guest counts are, then by how near in date, so the suggestion is the most
 *   comparable event rather than whichever one sorts earliest.
 */
export function findMatchingDiningLayout({
  currentEvent,
  events,
  requirements,
  adultCount,
  childrenCount
}: {
  currentEvent: Pick<DiningEvent, "id" | "hall" | "eventDate">;
  events: DiningEvent[];
  requirements: ReturnType<typeof diningTableRequirements>;
  adultCount: number;
  childrenCount: number;
}) {
  const candidates = events.filter((event) => {
    if (event.id === currentEvent.id || !event.diningPlan) return false;
    if (event.hall.id !== currentEvent.hall.id) return false;

    const signature = diningTableSignature(validTables(event.diningPlan.tables));

    return (
      signature.men === requirements.men &&
      signature.women === requirements.women &&
      signature.kids === requirements.kids
    );
  });

  if (candidates.length === 0) return null;

  const guestDistance = (event: DiningEvent) =>
    Math.abs((event.diningPlan?.adultCount ?? 0) - adultCount) +
    Math.abs((event.diningPlan?.childrenCount ?? 0) - childrenCount);

  return (
    [...candidates].sort((left, right) => {
      const byGuests = guestDistance(left) - guestDistance(right);
      if (byGuests !== 0) return byGuests;

      const byDate =
        daysApart(left.eventDate, currentEvent.eventDate) -
        daysApart(right.eventDate, currentEvent.eventDate);
      if (byDate !== 0) return byDate;

      // Deterministic tie-break so the same click always suggests the same
      // event.
      return left.id.localeCompare(right.id);
    })[0] ?? null
  );
}

export function cloneDiningLayoutTables(
  tables: DiningTableData[],
  createId: () => string = () => crypto.randomUUID()
) {
  return tables.map((table, index) => ({
    ...table,
    id: createId(),
    number: index + 1
  }));
}

function generatedTable({
  index,
  seats,
  side,
  x,
  y
}: {
  index: number;
  seats: number;
  side: TableSide;
  x: number;
  y: number;
}): DiningTableData {
  return {
    id: crypto.randomUUID(),
    height: 58,
    isSeating: true,
    mapType: side === "kids" ? "kids-table" : "round-table",
    name:
      side === "kids"
        ? `Kids table ${index + 1}`
        : side === "men"
          ? `Men table ${index + 1}`
          : `Women table ${index + 1}`,
    number: index + 1,
    seats,
    side,
    width: 58,
    x,
    y
  };
}

export function generateDiningAutoLayout(
  requirements: ReturnType<typeof diningTableRequirements>,
  // The same figure the requirement counts were worked out from. Generating
  // ten-seat tables to satisfy a count derived from twelve-seat ones would
  // leave the layout short of the seats it claims to provide.
  seatsPerTable: number = DEFAULT_SEATS_PER_TABLE
) {
  const seats = clampSeatsPerTable(seatsPerTable);
  const tables: DiningTableData[] = [];
  const rowGap = 88;
  const columnGap = 92;
  const columns = 4;
  const leftStartX = -360;
  const rightStartX = 80;
  const adultStartY = -250;

  for (let index = 0; index < requirements.men; index += 1) {
    tables.push(
      generatedTable({
        index: tables.length,
        seats,
        side: "men",
        x: leftStartX + (index % columns) * columnGap,
        y: adultStartY + Math.floor(index / columns) * rowGap
      })
    );
  }

  for (let index = 0; index < requirements.women; index += 1) {
    tables.push(
      generatedTable({
        index: tables.length,
        seats,
        side: "women",
        x: rightStartX + (index % columns) * columnGap,
        y: adultStartY + Math.floor(index / columns) * rowGap
      })
    );
  }

  for (let index = 0; index < requirements.kids; index += 1) {
    const goesLeft = index % 2 === 0;
    tables.push(
      generatedTable({
        index: tables.length,
        seats,
        side: "kids",
        x:
          (goesLeft ? -160 : 120) +
          Math.floor(index / 2) * (goesLeft ? -columnGap : columnGap),
        y: 170 + Math.floor(index / 4) * rowGap
      })
    );
  }

  tables.push({
    id: crypto.randomUUID(),
    height: 14,
    isSeating: false,
    mapType: "divider",
    name: "Mechitza",
    number: tables.length + 1,
    rotation: 0,
    seats: 0,
    side: "men",
    width: 360,
    x: -180,
    y: 70
  });

  return tables.map((table, index) => ({ ...table, number: index + 1 }));
}

export function validPresetObjects(value: unknown): HallMapObject[] {
  if (!Array.isArray(value)) return [];
  return value.filter((object): object is HallMapObject =>
    Boolean(
      object &&
      typeof object === "object" &&
      "id" in object &&
      "type" in object &&
      "name" in object &&
      "x" in object &&
      "y" in object &&
      "width" in object &&
      "height" in object &&
      "rotation" in object &&
      "seats" in object &&
      "seatingUse" in object
    )
  );
}

export function buildDiningTablesFromHallMapPresetObjects(
  objects: unknown,
  createId: () => string = () => crypto.randomUUID()
): DiningTableData[] {
  let adultIndex = 0;

  return validPresetObjects(objects).map((object, index) => {
    let side: TableSide;

    if (object.seatingUse === "kids") {
      side = "kids";
    } else if (object.seatingUse === "head") {
      side = "head";
    } else if (object.seatingUse === "adult") {
      side = adultIndex % 2 === 0 ? "men" : "women";
      adultIndex += 1;
    } else {
      side = "men";
    }

    return {
      id: createId(),
      isSeating: object.seats > 0 && object.seatingUse !== "none",
      mapObjectId: object.id,
      mapType: object.type,
      name: object.name,
      number: index + 1,
      rotation: object.rotation,
      seatingSides: object.seatingSides,
      seats: object.seats,
      side,
      x: object.x,
      y: object.y,
      width: object.width,
      height: object.height
    };
  });
}

/**
 * Whether the board still matches the preset it was loaded from.
 *
 * The Dining Manager edits a *copy*: picking a preset converts its objects into
 * this event's tables, and saving writes them to the dining plan, never back to
 * the preset. That is deliberate - a preset edited in January must not rewrite
 * the seating of an event that already ran in December - but the screen kept
 * showing the preset's name either way, so a rearranged plan was indistinguish-
 * able from an untouched one. This is what tells them apart.
 */
export function diningTablesMatchPreset(
  tables: DiningTableData[],
  presetObjects: unknown
) {
  // Ids are minted fresh on every load, so they carry no meaning here.
  const presetTables = buildDiningTablesFromHallMapPresetObjects(
    presetObjects,
    () => ""
  );

  if (presetTables.length !== tables.length) return false;

  // `number` is left out on purpose: it is positional bookkeeping that gets
  // rewritten by unrelated edits, not something a planner changed.
  const fingerprint = (table: DiningTableData) =>
    JSON.stringify([
      table.mapObjectId ?? null,
      table.name ?? null,
      table.side,
      table.seats,
      table.isSeating !== false,
      Math.round(table.x ?? 0),
      Math.round(table.y ?? 0),
      Math.round(table.width ?? 0),
      Math.round(table.height ?? 0),
      Math.round(table.rotation ?? 0)
    ]);

  const fromPreset = presetTables.map(fingerprint).sort();
  const onBoard = tables.map(fingerprint).sort();

  return fromPreset.every((table, index) => table === onBoard[index]);
}

export function defaultTables(): DiningTableData[] {
  return Array.from({ length: 8 }, (_, index) => ({
    id: crypto.randomUUID(),
    number: index + 1,
    seats: 10,
    side: index < 4 ? "men" : "women"
  }));
}

export function eventTitle(event: DiningEvent) {
  return `${event.clientName}${event.eventType ? ` ${event.eventType}` : ""}`;
}

export function eventSchedule(event: DiningEvent) {
  const date = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(event.eventDate));
  const time = event.startsAt
    ? new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit"
      }).format(new Date(event.startsAt))
    : "Time not set";
  return `${date} · ${time}`;
}

export function eventCounts(event: DiningEvent) {
  return {
    adults: event.couplesCount * 2 + event.menCount + event.ladiesCount,
    children: event.boysCount + event.girlsCount + event.kidsCount
  };
}
