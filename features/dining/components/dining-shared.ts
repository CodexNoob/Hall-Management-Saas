export type TableSide = "men" | "women" | "kids" | "head";

export type DiningTableData = {
  id: string;
  number: number;
  seats: number;
  side: TableSide;
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

export function validPresetObjects(value: unknown): HallMapObject[] {
  if (!Array.isArray(value)) return [];
  return value.filter((object): object is HallMapObject =>
    Boolean(
      object &&
      typeof object === "object" &&
      "id" in object &&
      "type" in object &&
      "name" in object &&
      "seats" in object &&
      "seatingUse" in object
    )
  );
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
