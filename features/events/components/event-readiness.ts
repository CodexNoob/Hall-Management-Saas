import type { MessageKey } from "@/lib/i18n/messages";
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
    | "billing";
  labelKey: MessageKey;
  done: boolean;
  helperKey: MessageKey;
  /** Interpolations for `helperKey`, when it names any. */
  helperValues?: Record<string, string | number>;
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
      labelKey: "events.ready.detailsLabel",
      done: eventDetailsDone,
      helperKey: eventDetailsDone
        ? "events.ready.detailsDone"
        : "events.ready.detailsTodo",
      scopes: ["event", "print"]
    },
    {
      id: "event-confirmed",
      labelKey: "events.ready.confirmedLabel",
      done: isConfirmed(event),
      helperKey: isConfirmed(event)
        ? "events.ready.confirmedDone"
        : "events.ready.confirmedTodo",
      scopes: ["event", "print"]
    },
    {
      id: "guest-count",
      labelKey: "events.ready.guestsLabel",
      done: hasPositiveCount(event.guests),
      helperKey: hasPositiveCount(event.guests)
        ? "events.ready.guestsDone"
        : "events.ready.guestsTodo",
      helperValues: { count: event.guests },
      scopes: ["event", "print"]
    },
    {
      id: "menu",
      labelKey: "events.ready.menuLabel",
      done: menuDone,
      helperKey: menuDone
        ? "events.ready.menuDone"
        : "events.ready.menuTodo",
      scopes: ["event", "print"]
    },
    {
      id: "hall-map",
      labelKey: "events.ready.hallMapLabel",
      done: Boolean(event.diningHallMapPreset),
      helperKey: event.diningHallMapPreset
        ? "events.ready.hallMapDone"
        : "events.ready.hallMapTodo",
      helperValues: {
        name: event.diningHallMapPreset?.name ?? ""
      },
      scopes: ["event", "print"]
    },
    {
      id: "timeline",
      labelKey: "events.ready.timelineLabel",
      done: timelineDone,
      helperKey: timelineDone
        ? "events.ready.timelineDone"
        : "events.ready.timelineTodo",
      scopes: ["event", "print"]
    },
    {
      id: "dining-plan",
      labelKey: "events.ready.diningLabel",
      done: hasValue(event.diningManagerNotes),
      helperKey: hasValue(event.diningManagerNotes)
        ? "events.ready.diningDone"
        : "events.ready.diningTodo",
      scopes: ["event"]
    },
    {
      id: "billing",
      labelKey: "events.ready.billingLabel",
      done: isBillingReviewed(event),
      helperKey: isBillingReviewed(event)
        ? "events.ready.billingDone"
        : "events.ready.billingTodo",
      helperValues: { status: event.paymentStatus },
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
