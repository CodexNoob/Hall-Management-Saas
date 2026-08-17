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

export function diningTableRequirements(input: {
  childrenCount: number;
  menRequired: number;
  womenRequired: number;
  tableCapacity?: number;
}) {
  const tableCapacity = Math.max(1, input.tableCapacity ?? 10);

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

export function findMatchingDiningLayout({
  currentEventId,
  events,
  requirements
}: {
  currentEventId: string;
  events: DiningEvent[];
  requirements: ReturnType<typeof diningTableRequirements>;
}) {
  return (
    events.find((event) => {
      if (event.id === currentEventId || !event.diningPlan) return false;

      const tables = validTables(event.diningPlan.tables);
      const signature = diningTableSignature(tables);

      return (
        signature.men === requirements.men &&
        signature.women === requirements.women &&
        signature.kids === requirements.kids
      );
    }) ?? null
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
  side,
  x,
  y
}: {
  index: number;
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
    seats: 10,
    side,
    width: 58,
    x,
    y
  };
}

export function generateDiningAutoLayout(
  requirements: ReturnType<typeof diningTableRequirements>
) {
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
      seats: object.seats,
      side,
      x: object.x,
      y: object.y,
      width: object.width,
      height: object.height
    };
  });
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
