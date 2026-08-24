import { type EventFile } from "@/features/events/components/event-manager-shared";
import {
  showBillingReadouts,
  showOperationsReadiness
} from "@/lib/ui/mvp-features";

export type EventReadinessScope = "event" | "print";

export type EventReadinessItem = {
  id:
    | "event-details"
    | "event-confirmed"
    | "guest-count"
    | "menu"
    | "hall-map"
    | "timeline"
    | "dining-plan"
    | "billing"
    | "kitchen-packet";
  label: string;
  done: boolean;
  helper: string;
  scopes: EventReadinessScope[];
};

function hasValue(value: unknown) {
  return typeof value === "string" ? value.trim().length > 0 : Boolean(value);
}

function hasPositiveCount(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

function isConfirmed(event: EventFile) {
  return (
    event.bookingStatus === "CONFIRMED" || event.bookingStatus === "COMPLETED"
  );
}

function isBillingReviewed(event: EventFile) {
  return !["No invoice", "Not started", "Unpaid"].includes(event.paymentStatus);
}

function isTimelineConfirmed(event: EventFile) {
  return event.workspaceData.timelineConfirmed === true;
}

function isMenuConfirmed(event: EventFile) {
  return event.workspaceData.menuConfirmed === true;
}

/**
 * Which checks apply at all, before the per-event answers.
 *
 * Hall map, dining plan and billing are each satisfied from a module the MVP
 * hides (lib/ui/mvp-features), so leaving them listed would show three items no
 * user can tick - and, because Print packet is disabled until every print-scoped
 * item is done, would put printing out of reach entirely.
 */
function isReadinessItemAvailable(id: EventReadinessItem["id"]) {
  if (id === "billing") return showBillingReadouts;
  if (id === "hall-map" || id === "dining-plan") return showOperationsReadiness;
  return true;
}

export function getEventReadinessItems(event: EventFile): EventReadinessItem[] {
  const eventDetailsDone =
    hasValue(event.clientName) &&
    hasValue(event.dateInput) &&
    hasValue(event.timeInput) &&
    hasValue(event.hallId);
  const timelineDone = isTimelineConfirmed(event);
  const menuDone = isMenuConfirmed(event);

  const items: EventReadinessItem[] = [
    {
      id: "event-details",
      label: "Event details completed",
      done: eventDetailsDone,
      helper: eventDetailsDone
        ? "Client, date, time, and room are filled."
        : "Fill client, date, time, and room.",
      scopes: ["event", "print"]
    },
    {
      id: "event-confirmed",
      label: "Event confirmed",
      done: isConfirmed(event),
      helper: isConfirmed(event)
        ? "The booking is confirmed."
        : "Confirm the event before final operations.",
      scopes: ["event", "print"]
    },
    {
      id: "guest-count",
      label: "Guest count filled",
      done: hasPositiveCount(event.guests),
      helper: hasPositiveCount(event.guests)
        ? `${event.guests} guests are recorded.`
        : "Add the expected guest count.",
      scopes: ["event", "print"]
    },
    {
      id: "menu",
      label: "Menu ready",
      done: menuDone,
      helper: menuDone
        ? "Menu has been reviewed and confirmed."
        : "Review and confirm the event menu.",
      scopes: ["event", "print"]
    },
    {
      id: "hall-map",
      label: "Hall map selected",
      done: Boolean(event.diningHallMapPreset),
      helper: event.diningHallMapPreset
        ? `${event.diningHallMapPreset.name} is attached.`
        : "Attach a hall map or dining preset.",
      scopes: ["event", "print"]
    },
    {
      id: "timeline",
      label: "Timeline ready",
      done: timelineDone,
      helper: timelineDone
        ? "Timeline has been confirmed."
        : "Confirm the timeline instructions.",
      scopes: ["event", "print"]
    },
    {
      id: "dining-plan",
      label: "Dining plan notes ready",
      done: hasValue(event.diningManagerNotes),
      helper: hasValue(event.diningManagerNotes)
        ? "Dining Manager notes are available."
        : "Save Dining Manager notes for this event.",
      scopes: ["event"]
    },
    {
      id: "billing",
      label: "Billing reviewed",
      done: isBillingReviewed(event),
      helper: isBillingReviewed(event)
        ? `Payment status: ${event.paymentStatus}.`
        : "Review invoice/payment status.",
      scopes: ["event", "print"]
    },
    {
      id: "kitchen-packet",
      label: "Operations notes ready",
      done:
        hasValue(event.internalNotes) ||
        hasValue(event.daveningNote) ||
        hasValue(event.sideBoxes) ||
        hasValue(event.shabbosSetup),
      helper:
        hasValue(event.internalNotes) ||
        hasValue(event.daveningNote) ||
        hasValue(event.sideBoxes) ||
        hasValue(event.shabbosSetup)
          ? "Internal operation notes are available."
          : "Add operation notes if staff need instructions.",
      scopes: ["event", "print"]
    }
  ];

  return items.filter((item) => isReadinessItemAvailable(item.id));
}

export function getScopedEventReadinessItems(
  event: EventFile,
  scope: EventReadinessScope
) {
  return getEventReadinessItems(event).filter((item) =>
    item.scopes.includes(scope)
  );
}

export function getEventReadinessSummary(
  event: EventFile,
  scope: EventReadinessScope
) {
  const items = getScopedEventReadinessItems(event, scope);
  const completed = items.filter((item) => item.done).length;

  return {
    completed,
    total: items.length,
    ready: completed === items.length
  };
}
