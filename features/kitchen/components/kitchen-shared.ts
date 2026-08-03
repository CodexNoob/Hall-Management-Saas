import { addDays, startOfWeek } from "@/lib/dates/calendar-date";

export type KitchenView = "today" | "week" | "four-weeks";

export type KitchenEvent = {
  id: string;
  category: string;
  title: string;
  portions: string;
  packageName: string;
  status?: string;
  statusType?: "hold" | "kitchen";
  menuItems?: KitchenMenuItem[];
};

export type KitchenMenuItem = {
  id: string;
  name: string;
  category?: string | null;
  status?: "PENDING" | "COMPLETE" | null;
  assignedWorkerId?: string | null;
  assignedWorkerName?: string | null;
};

export type KitchenDay = {
  dateKey: string;
  dayName: string;
  dateLabel: string;
  dayNumber: number;
  shabbos?: boolean;
  selected?: boolean;
  today?: boolean;
  events?: KitchenEvent[];
};

export type KitchenResponse = {
  events: Array<{
    id: string;
    clientName: string;
    eventDate: string;
    eventType: string | null;
    eventStatus: string;
    packageName: string | null;
    couplesCount: number;
    menCount: number;
    ladiesCount: number;
    boysCount: number;
    girlsCount: number;
    kidsCount: number;
    hall: { name: string };
    menuItems: KitchenMenuItem[];
  }>;
  workers: Array<{ id: string; name: string }>;
  menuItems: Array<{
    id: string;
    name: string;
    category?: string | null;
    usageType: string;
  }>;
  permissions: {
    canEditMenu: boolean;
    canAssignWorkers: boolean;
    canUpdateKitchenStatus: boolean;
    canAddKitchenEvents: boolean;
  };
};

export const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Shabbos"];

export function kitchenViewInformation(activeView: KitchenView, anchorDate: Date) {
  const fullDate = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });
  const shortDate = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  });
  const rangeStart =
    activeView === "today" ? anchorDate : startOfWeek(anchorDate);
  const rangeEnd = addDays(rangeStart, activeView === "week" ? 6 : 27);

  return {
    heading:
      activeView === "today"
        ? fullDate.format(anchorDate)
        : `${activeView === "week" ? "This Week" : "4 Weeks"} · ${shortDate.format(rangeStart)} – ${shortDate.format(rangeEnd)}`,
    time: `Current time: ${new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit"
    }).format(new Date())}`
  };
}
