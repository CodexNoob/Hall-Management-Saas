"use client";

import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";
import { readApiError } from "@/lib/http/api-request-error";
import { countSchema } from "@/lib/validation/number";
import { readNumericFields } from "@/lib/validation/numeric-form";
import {
  LineIcon,
  timelineRows,
  type EventFile,
  type EventHallOption,
  type EventWorkspaceTab,
  type IconName
} from "@/features/events/components/event-manager-shared";
import {
  getEventReadinessSummary,
  getScopedEventReadinessItems,
  type EventReadinessItem
} from "@/features/events/components/event-readiness";

export function Field({
  label,
  children,
  className = ""
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block text-xs font-medium text-[#6a7483] ${className}`}>
      {label}
      {children}
    </label>
  );
}

/**
 * Sections collapse only when they hold nothing, so a blank event opens as a
 * short form while an event with operations filled in still shows them. Hiding
 * saved values behind a chevron reads as data loss, which is why "empty" rather
 * than "secondary" decides the default.
 */
function EventDetailsSection({
  id,
  title,
  summary,
  defaultOpen,
  forceOpen = false,
  children
}: {
  id: string;
  title: string;
  summary: string;
  defaultOpen: boolean;
  forceOpen?: boolean;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const isExpanded = isOpen || forceOpen;

  return (
    <section className="border-t border-[#e7ebf0] pt-4 first:border-t-0 first:pt-0" id={id}>
      <button
        aria-expanded={isExpanded}
        className="group flex w-full items-center gap-2 rounded-lg text-left"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <LineIcon
          name="chevron"
          className={`h-4 w-4 shrink-0 text-[#8b95a5] transition-transform ${
            isExpanded ? "rotate-90" : ""
          }`}
        />
        <h3 className="shrink-0 text-[13px] font-semibold text-[#17202a]">
          {title}
        </h3>
        {isExpanded ? null : (
          <span className="min-w-0 flex-1 truncate text-xs font-normal text-[#8b95a5]">
            {summary}
          </span>
        )}
      </button>
      {isExpanded ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-3">{children}</div>
      ) : null}
    </section>
  );
}

export function ClientContact({ event }: { event: EventFile }) {
  const rows = [
    {
      icon: "phone",
      label: event.phone || "Phone not provided",
      href: event.phone ? `tel:${event.phone}` : undefined
    },
    {
      icon: "mail",
      label: event.email || "Email not provided",
      href: event.email ? `mailto:${event.email}` : undefined
    },
    { icon: "couples", label: event.coordinator, href: undefined }
  ] satisfies Array<{ icon: IconName; label: string; href?: string }>;

  return (
    <section className="rounded-lg border border-[#d8dde5] bg-white">
      <header className="flex h-11 items-center gap-2 border-b border-[#d8dde5] px-4">
        <LineIcon name="user" />
        <h2 className="text-sm font-semibold text-[#17202a]">Client contact</h2>
      </header>
      <div className="p-2">
        {rows.map((row) => (
          <a
            key={row.label}
            className={`flex h-11 w-full items-center gap-3 rounded-lg px-2 text-left text-sm ${
              row.href
                ? "font-medium text-[#17202a] hover:bg-[#eef4fa]"
                : "cursor-default font-normal text-[#8b95a5]"
            }`}
            href={row.href}
            aria-disabled={!row.href}
            onClick={(clickEvent) => {
              if (!row.href) clickEvent.preventDefault();
            }}
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f1f5f9] ${
                row.href ? "text-[#1f4d73]" : "text-[#a3adba]"
              }`}
            >
              <LineIcon name={row.icon} />
            </span>
            <span className="min-w-0 flex-1 truncate">{row.label}</span>
            {row.href ? (
              <LineIcon name="chevron" className="h-4 w-4 text-[#8b95a5]" />
            ) : null}
          </a>
        ))}
      </div>
    </section>
  );
}

/**
 * Where each readiness item is actually fixed. The checklist used to state a
 * problem and leave the reader to hunt for the field, so every row now carries
 * the route to its own remedy.
 */
const readinessTargets: Record<
  EventReadinessItem["id"],
  { tab: EventWorkspaceTab; sectionId?: string; fieldId?: string }
> = {
  "event-details": {
    tab: "Event details",
    sectionId: "event-section-basic",
    fieldId: "event-client-name"
  },
  "event-confirmed": {
    tab: "Event details",
    sectionId: "event-section-basic",
    fieldId: "event-booking-status"
  },
  "guest-count": {
    tab: "Event details",
    sectionId: "event-section-guests",
    fieldId: "event-guest-count"
  },
  menu: { tab: "Menu" },
  "hall-map": { tab: "Hall map" },
  timeline: { tab: "Event details", sectionId: "event-timeline" },
  "dining-plan": {
    tab: "Event details",
    sectionId: "event-section-notes",
    fieldId: "event-internal-notes"
  },
  billing: { tab: "Billing" },
  "kitchen-packet": {
    tab: "Event details",
    sectionId: "event-section-notes",
    fieldId: "event-internal-notes"
  }
};

function revealReadinessTarget(target: {
  sectionId?: string;
  fieldId?: string;
}) {
  const section = target.sectionId
    ? document.getElementById(target.sectionId)
    : null;
  // A collapsed section has not rendered its inputs yet, so it has to be opened
  // before there is anything to focus.
  section
    ?.querySelector<HTMLButtonElement>('button[aria-expanded="false"]')
    ?.click();

  requestAnimationFrame(() => {
    const field = target.fieldId
      ? document.getElementById(target.fieldId)
      : null;
    (field ?? section)?.scrollIntoView({ behavior: "smooth", block: "center" });
    field?.focus({ preventScroll: true });
  });
}

export function ReadinessPanel({
  event,
  onOpenTab
}: {
  event: EventFile;
  onOpenTab?: (tab: EventWorkspaceTab) => void;
}) {
  const rows = getScopedEventReadinessItems(event, "event");
  const summary = getEventReadinessSummary(event, "event");
  const [showCompleted, setShowCompleted] = useState(false);
  const outstanding = rows.filter((row) => !row.done);
  const completed = rows.filter((row) => row.done);
  const visibleRows = showCompleted ? rows : outstanding;

  return (
    <section className="rounded-lg border border-[#d8dde5] bg-white">
      <header className="border-b border-[#d8dde5] px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <LineIcon name="files" />
            <h2 className="text-sm font-semibold text-[#17202a]">Readiness</h2>
          </div>
          <span
            className={`text-xs font-medium ${
              summary.ready ? "text-[#146c43]" : "text-[#946200]"
            }`}
          >
            {summary.ready
              ? "Ready"
              : `${summary.completed} of ${summary.total}`}
          </span>
        </div>
        <div
          aria-hidden="true"
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#eef1f5]"
        >
          <div
            className={`h-full rounded-full transition-[width] ${
              summary.ready ? "bg-[#12b76a]" : "bg-[#1f4d73]"
            }`}
            style={{
              width: `${Math.round((summary.completed / summary.total) * 100)}%`
            }}
          />
        </div>
      </header>
      <div className="p-2">
        {summary.ready ? (
          <p className="px-2 py-3 text-sm font-medium text-[#146c43]">
            Everything for this event is in place.
          </p>
        ) : null}

        {visibleRows.map((row) => {
          const target = readinessTargets[row.id];

          return (
            <button
              key={row.id}
              className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left hover:bg-[#eef4fa]"
              onClick={() => {
                onOpenTab?.(target.tab);
                revealReadinessTarget(target);
              }}
              type="button"
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                  row.done
                    ? "border-[#12b76a] bg-[#12b76a] text-white"
                    : "border-[#b9c2cf] text-transparent"
                }`}
              >
                {row.done ? <LineIcon name="check" className="h-3 w-3" /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block text-sm leading-5 ${
                    row.done
                      ? "font-normal text-[#8b95a5]"
                      : "font-medium text-[#17202a]"
                  }`}
                >
                  {row.label}
                </span>
                {row.done ? null : (
                  <span className="mt-0.5 block text-xs font-normal leading-4 text-[#6a7483]">
                    {row.helper}
                  </span>
                )}
              </span>
            </button>
          );
        })}

        {completed.length && !summary.ready ? (
          <button
            className="mt-1 w-full rounded-lg px-2 py-2 text-left text-xs font-medium text-[#1f4d73] hover:bg-[#eef4fa]"
            onClick={() => setShowCompleted((current) => !current)}
            type="button"
          >
            {showCompleted
              ? "Hide completed"
              : `Show ${completed.length} completed`}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function formatActivityTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function EventActivityHistory({ event }: { event: EventFile }) {
  const activityLogs = event.activityLogs.slice(0, 6);

  return (
    <section className="rounded-lg border border-[#d8dde5] bg-white">
      <header className="flex h-11 items-center gap-2 border-b border-[#d8dde5] px-4">
        <LineIcon name="clock" />
        <h2 className="text-sm font-semibold text-[#17202a]">Activity history</h2>
      </header>

      {activityLogs.length ? (
        <ol className="divide-y divide-[#eef1f5] px-4">
          {activityLogs.map((activity) => (
            <li key={activity.id} className="py-3">
              <p className="text-sm font-medium leading-5 text-[#17202a]">
                {activity.message}
              </p>
              <p className="mt-1 text-xs font-normal text-[#8b95a5]">
                {activity.actionType} ·{" "}
                {activity.userName ? `${activity.userName} · ` : "System · "}
                <time dateTime={activity.createdAt}>
                  {formatActivityTimestamp(activity.createdAt)}
                </time>
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="px-4 py-6 text-center text-sm font-normal text-[#8b95a5]">
          No activity has been recorded for this event yet.
        </p>
      )}
    </section>
  );
}

type EventCountField =
  | "guestCount"
  | "childrenCount"
  | "couplesCount"
  | "waitersCount";

type EventDetailsDraft = {
  // Counts stay as the raw text the user typed and are parsed on save. Storing
  // them as numbers meant `Number("")` silently wrote 0.
  childrenCount: string;
  clientName: string;
  couplesCount: string;
  eventDate: string;
  eventStatus: string;
  eventTime: string;
  eventType: string;
  guestCount: string;
  hallId: string;
  internalNotes: string;
  daveningNote: string;
  memberShulName: string;
  setupTime: string;
  shabbosSetup: string;
  sideBoxes: string;
  tableclothName: string;
  waitersCount: string;
  washingTime: string;
};

function countText(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(parsed) : "0";
}

function isPositiveCount(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

/**
 * Builds the line a collapsed section shows in place of its fields, and reports
 * whether it holds anything - which is also what decides if it starts open.
 */
function summarize(
  parts: Array<string | false | null | undefined>,
  emptyText: string
) {
  const filled = parts.filter((part): part is string => Boolean(part));

  return {
    text: filled.length ? filled.join(" · ") : emptyText,
    isFilled: filled.length > 0
  };
}

function summarizeBasics(source: EventDetailsDraft, hallName?: string) {
  return summarize(
    [source.clientName.trim(), source.eventType.trim(), hallName],
    "Not filled in yet"
  );
}

function summarizeGuests(source: EventDetailsDraft) {
  return summarize(
    [
      isPositiveCount(source.guestCount) && `${source.guestCount} guests`,
      isPositiveCount(source.childrenCount) && `${source.childrenCount} children`,
      isPositiveCount(source.couplesCount) && `${source.couplesCount} couples`
    ],
    "No counts yet"
  );
}

function summarizeOperations(source: EventDetailsDraft) {
  return summarize(
    [
      source.setupTime && `Setup ${source.setupTime}`,
      source.washingTime && `Washing ${source.washingTime}`,
      isPositiveCount(source.waitersCount) && `${source.waitersCount} waiters`,
      source.tableclothName.trim(),
      source.memberShulName.trim()
    ],
    "Nothing set"
  );
}

function summarizeNotes(
  source: EventDetailsDraft,
  diningManagerNotes: string | null
) {
  return summarize(
    [
      source.internalNotes.trim() && "Internal",
      source.daveningNote.trim() && "Davening",
      source.sideBoxes.trim() && "Side boxes",
      source.shabbosSetup.trim() && "Shabbos setup",
      diningManagerNotes && "Dining Manager"
    ],
    "No notes yet"
  );
}

type EventLifecycleStatus =
  | "INQUIRY"
  | "TENTATIVE_HOLD"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "EXPIRED";

type EventLifecycleAction = {
  status: EventLifecycleStatus;
  label: string;
  confirmLabel: string;
  title: string;
  description: string;
  tone: "primary" | "danger";
};

const eventLifecycleActions: Record<EventLifecycleStatus, EventLifecycleAction[]> =
  {
    INQUIRY: [
      {
        status: "TENTATIVE_HOLD",
        label: "Place on hold",
        confirmLabel: "Place on hold",
        title: "Place this event on hold?",
        description:
          "This reserves the event as a tentative hold and keeps it active for planning.",
        tone: "primary"
      },
      {
        status: "CANCELLED",
        label: "Cancel event",
        confirmLabel: "Cancel event",
        title: "Cancel this event?",
        description:
          "This will move the event out of active operations and save a cancellation timestamp in Supabase.",
        tone: "danger"
      }
    ],
    TENTATIVE_HOLD: [
      {
        status: "CONFIRMED",
        label: "Confirm event",
        confirmLabel: "Confirm event",
        title: "Confirm this event?",
        description:
          "This confirms the booking, keeps the hall reserved, and moves the event into active operations.",
        tone: "primary"
      },
      {
        status: "CANCELLED",
        label: "Cancel event",
        confirmLabel: "Cancel event",
        title: "Cancel this event?",
        description:
          "This will move the event out of active operations and save a cancellation timestamp in Supabase.",
        tone: "danger"
      }
    ],
    CONFIRMED: [
      {
        status: "COMPLETED",
        label: "Mark completed",
        confirmLabel: "Mark completed",
        title: "Mark this event as completed?",
        description:
          "This closes the event as completed and saves a completed timestamp in Supabase.",
        tone: "primary"
      },
      {
        status: "CANCELLED",
        label: "Cancel event",
        confirmLabel: "Cancel event",
        title: "Cancel this event?",
        description:
          "This will move the event out of active operations and save a cancellation timestamp in Supabase.",
        tone: "danger"
      }
    ],
    COMPLETED: [],
    CANCELLED: [],
    EXPIRED: []
  };

export function getEventLifecycleActions(bookingStatus: string) {
  const normalizedStatus = bookingStatus as EventLifecycleStatus;

  return eventLifecycleActions[normalizedStatus] ?? [];
}

function getEventLifecycleStatusLabel(status: string) {
  const labels: Record<EventLifecycleStatus, string> = {
    INQUIRY: "Inquiry",
    TENTATIVE_HOLD: "Hold",
    CONFIRMED: "Confirmed",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    EXPIRED: "Expired"
  };

  return labels[status as EventLifecycleStatus] ?? status;
}

export function createEventDetailsDraft(event: EventFile): EventDetailsDraft {
  return {
    childrenCount: countText(event.children),
    clientName: event.clientName,
    couplesCount: countText(event.couples),
    eventDate: event.dateInput,
    eventStatus: event.status,
    eventTime: event.timeInput,
    eventType: event.eventType,
    guestCount: countText(event.guests),
    hallId: event.hallId,
    internalNotes: event.internalNotes,
    daveningNote: event.daveningNote,
    memberShulName: event.memberShulName,
    setupTime: event.setupTime,
    shabbosSetup: event.shabbosSetup,
    sideBoxes: event.sideBoxes,
    tableclothName: event.tableclothName,
    waitersCount: countText(event.waitersCount),
    washingTime: event.washingTime
  };
}

export function createEventDetailsDraftSignature(draft: EventDetailsDraft) {
  return JSON.stringify(draft);
}

export function validateEventDetailsDraft(draft: EventDetailsDraft) {
  const errors: string[] = [];
  const guests = Number(draft.guestCount);
  const children = Number(draft.childrenCount);
  const couples = Number(draft.couplesCount);
  const integerFields = [
    ["Guests", guests],
    ["Children", children],
    ["Couples", couples],
    ["Waiters", Number(draft.waitersCount)]
  ] as const;

  if (!draft.clientName.trim()) {
    errors.push("Client name is required.");
  }

  if (!draft.eventDate) {
    errors.push("Event date is required.");
  }

  for (const [label, value] of integerFields) {
    if (!Number.isInteger(value) || value < 0) {
      errors.push(`${label} must be a whole number of 0 or more.`);
    }
  }

  if (Number.isFinite(children) && Number.isFinite(guests) && children > guests) {
    errors.push("Children cannot be greater than total guests.");
  }

  if (Number.isFinite(couples) && Number.isFinite(guests) && couples * 2 > guests) {
    errors.push("Couples cannot require more seats than total guests.");
  }

  return errors;
}

export function normalizeEventStatusForSave(status: string) {
  return status.toLowerCase().includes("confirm") ? "Confirmed" : "Hold";
}

export function EventInformation({
  event,
  halls,
  onEventSaved
}: {
  event: EventFile;
  halls: EventHallOption[];
  onEventSaved: () => Promise<unknown>;
}) {
  const [draft, setDraft] = useState<EventDetailsDraft>(() =>
    createEventDetailsDraft(event)
  );
  const [countErrors, setCountErrors] = useState<
    Partial<Record<EventCountField, string>>
  >({});
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [statusAction, setStatusAction] = useState<
    EventLifecycleStatus | null
  >(null);
  const [pendingStatusAction, setPendingStatusAction] = useState<
    EventLifecycleAction | null
  >(null);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const saveConfirmationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const previousEventIdRef = useRef(event.id);
  const savedDraft = useMemo(() => createEventDetailsDraft(event), [event]);
  const savedDraftSignature = useMemo(
    () => createEventDetailsDraftSignature(savedDraft),
    [savedDraft]
  );
  const currentDraftSignature = useMemo(
    () => createEventDetailsDraftSignature(draft),
    [draft]
  );
  const hasUnsavedChanges = currentDraftSignature !== savedDraftSignature;
  const validationErrors = useMemo(
    () => validateEventDetailsDraft(draft),
    [draft]
  );
  const hasValidationErrors = validationErrors.length > 0;

  useEffect(() => {
    const didSwitchEvent = previousEventIdRef.current !== event.id;
    previousEventIdRef.current = event.id;

    setDraft(createEventDetailsDraft(event));
    if (didSwitchEvent) {
      setMessage("");
      setShowSaveConfirmation(false);
    }
  }, [event]);

  useEffect(
    () => () => {
      if (saveConfirmationTimerRef.current) {
        clearTimeout(saveConfirmationTimerRef.current);
      }
    },
    []
  );

  function updateDraft<K extends keyof EventDetailsDraft>(
    field: K,
    value: EventDetailsDraft[K]
  ) {
    setMessage("");
    setShowSaveConfirmation(false);
    setCountErrors((current) => ({ ...current, [field]: undefined }));
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function discardChanges() {
    setDraft(createEventDetailsDraft(event));
    setCountErrors({});
    setShowSaveConfirmation(false);
    setMessage("Unsaved event detail changes discarded.");
  }

  async function saveEvent(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setMessage("");

    const counts = readNumericFields<EventCountField>({
      guestCount: {
        raw: draft.guestCount,
        schema: countSchema({ label: "Guests" }),
        emptyMessage: "Enter a guest count."
      },
      childrenCount: {
        raw: draft.childrenCount,
        schema: countSchema({ label: "Children" }),
        emptyMessage: "Enter a children count."
      },
      couplesCount: {
        raw: draft.couplesCount,
        schema: countSchema({ label: "Couples" }),
        emptyMessage: "Enter a couples count."
      },
      waitersCount: {
        raw: draft.waitersCount,
        schema: countSchema({ label: "Waiters" }),
        emptyMessage: "Enter a waiter count."
      }
    });

    if (!counts.ok) {
      setCountErrors(counts.errors);
      setMessage(counts.firstError);
      return;
    }

    setCountErrors({});
    setIsSaving(true);

    const guestCount = counts.values.guestCount ?? 0;
    const childrenCount = counts.values.childrenCount ?? 0;
    const couplesCount = counts.values.couplesCount ?? 0;
    const waitersCount = counts.values.waitersCount ?? 0;
    const eventDate = draft.eventDate;
    const eventTime = draft.eventTime;
    const startsAt =
      eventDate && eventTime
        ? new Date(`${eventDate}T${eventTime}:00`).toISOString()
        : null;

    try {
      const response = await authenticatedFetch(`/api/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: draft.clientName.trim(),
          eventType: draft.eventType.trim() || undefined,
          eventStatus: normalizeEventStatusForSave(draft.eventStatus),
          eventDate,
          hallId: draft.hallId,
          startsAt,
          couplesCount,
          boysCount: 0,
          girlsCount: 0,
          kidsCount: childrenCount,
          ladiesCount: 0,
          menCount: Math.max(guestCount - childrenCount - couplesCount * 2, 0),
          notes: draft.internalNotes,
          daveningNote: draft.daveningNote,
          setupTime: draft.setupTime || null,
          washingTime: draft.washingTime || null,
          tableclothName: draft.tableclothName.trim() || null,
          waitersCount,
          memberShulName: draft.memberShulName.trim() || null,
          sideBoxes: draft.sideBoxes.trim() || null,
          shabbosSetup: draft.shabbosSetup.trim() || null
        })
      });
      if (!response.ok) throw await readApiError(response);
      await onEventSaved();
      setMessage("Event details saved successfully.");
      setShowSaveConfirmation(true);
      if (saveConfirmationTimerRef.current) {
        clearTimeout(saveConfirmationTimerRef.current);
      }
      saveConfirmationTimerRef.current = setTimeout(
        () => setShowSaveConfirmation(false),
        4000
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not save event."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function updateBookingStatus(action: EventLifecycleAction) {
    const { status } = action;
    setStatusAction(status);
    setPendingStatusAction(null);
    setMessage("");
    setShowSaveConfirmation(false);

    try {
      const response = await authenticatedFetch(
        `/api/events/${event.id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            expectedVersion: event.version
          })
        }
      );
      const result = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(result.error ?? "Could not update event status.");
      await onEventSaved();
      setMessage(`${action.confirmLabel} saved successfully.`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not update event status."
      );
    } finally {
      setStatusAction(null);
    }
  }

  const isFinalBookingStatus = ["CANCELLED", "COMPLETED", "EXPIRED"].includes(
    event.bookingStatus
  );
  const lifecycleActions = getEventLifecycleActions(event.bookingStatus);
  const hallName = halls.find((hall) => hall.id === draft.hallId)?.name;
  const basicSummary = summarizeBasics(draft, hallName);
  const guestSummary = summarizeGuests(draft);
  const operationsSummary = summarizeOperations(draft);
  const notesSummary = summarizeNotes(draft, event.diningManagerNotes);
  // Whether a section starts open has to come from the saved event: `draft`
  // only catches up in an effect, so on the render that switches events it
  // still describes the event we just left.
  const savedOperations = summarizeOperations(savedDraft);
  const savedNotes = summarizeNotes(savedDraft, event.diningManagerNotes);

  return (
    <form
      className="relative rounded-lg border border-[#d8dde5] bg-white"
      onSubmit={saveEvent}
    >
      {showSaveConfirmation ? (
        <div
          className="pointer-events-none absolute left-1/2 top-3 z-20 flex w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 items-start gap-3 rounded-xl border border-[#a6e7c3] bg-[#ecfdf3]/95 px-4 py-3 text-[#065f46] shadow-lg backdrop-blur"
          role="status"
        >
          <span
            aria-hidden="true"
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#12b76a] text-white"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="3"
              viewBox="0 0 24 24"
            >
              <path d="m5 13 4 4L19 7" />
            </svg>
          </span>

          <div className="min-w-0">
            <p className="text-sm font-black">Event details saved</p>
            <p className="mt-0.5 text-xs font-semibold text-[#047857]">
              Your changes were saved successfully.
            </p>
          </div>
        </div>
      ) : null}
      {pendingStatusAction ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#17202a]/45 p-4 backdrop-blur-sm"
          role="presentation"
        >
          <section
            aria-modal="true"
            aria-labelledby="event-lifecycle-confirm-title"
            className="w-full max-w-md overflow-hidden rounded-2xl border border-[#d8dde5] bg-white shadow-2xl"
            role="dialog"
          >
            <header className="border-b border-[#d8dde5] px-5 py-4">
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#1f4d73]">
                Event lifecycle
              </p>
              <h3
                className="mt-1 text-lg font-black text-[#17202a]"
                id="event-lifecycle-confirm-title"
              >
                {pendingStatusAction.title}
              </h3>
            </header>
            <div className="space-y-3 px-5 py-4 text-sm font-medium leading-6 text-[#516174]">
              <p>{pendingStatusAction.description}</p>
              <p className="rounded-xl border border-[#d8dde5] bg-[#fbfcfd] p-3 text-xs font-bold text-[#17202a]">
                Event: {event.title}
              </p>
            </div>
            <footer className="flex flex-wrap justify-end gap-2 border-t border-[#d8dde5] bg-[#fbfcfd] px-5 py-4">
              <button
                className="inline-flex h-10 items-center justify-center rounded-xl border border-[#b9c2cf] bg-white px-4 text-sm font-black text-[#17202a] hover:bg-[#eef4fa]"
                onClick={() => setPendingStatusAction(null)}
                type="button"
              >
                Keep editing
              </button>
              <button
                className={`inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-black text-white ${
                  pendingStatusAction.tone === "danger"
                    ? "bg-[#b42318] hover:bg-[#912018]"
                    : "bg-[#1f4d73] hover:bg-[#15344f]"
                }`}
                onClick={() => updateBookingStatus(pendingStatusAction)}
                type="button"
              >
                {pendingStatusAction.confirmLabel}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
      <header className="flex h-11 items-center gap-2 border-b border-[#d8dde5] px-4">
        <LineIcon name="calendar" />
        <h2 className="text-sm font-semibold text-[#17202a]">
          Event information
        </h2>
        {hasUnsavedChanges ? (
          <span className="ml-auto rounded-full border border-[#fedf89] bg-[#fffbeb] px-2.5 py-0.5 text-[11px] font-medium text-[#b54708]">
            Unsaved changes
          </span>
        ) : null}
      </header>
      <div className="space-y-4 p-4">
        <EventDetailsSection
          defaultOpen
          id="event-section-basic"
          key={`${event.id}-basic`}
          summary={basicSummary.text}
          title="Basic details"
        >
          <Field label="Client">
            <input
              className="mt-1 h-9 w-full rounded-lg border border-[#d8dde5] bg-white px-3 text-sm font-medium text-[#17202a]"
              id="event-client-name"
              name="clientName"
              onChange={(changeEvent) =>
                updateDraft("clientName", changeEvent.target.value)
              }
              value={draft.clientName}
            />
          </Field>
          <Field label="Event type">
            <input
              className="mt-1 h-9 w-full rounded-lg border border-[#d8dde5] bg-white px-3 text-sm font-medium text-[#17202a]"
              name="eventType"
              onChange={(changeEvent) =>
                updateDraft("eventType", changeEvent.target.value)
              }
              value={draft.eventType}
            />
          </Field>
          <Field label="Status">
            <select
              aria-label="Event status"
              className="mt-1 h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm font-medium text-[#17202a]"
              disabled={Boolean(statusAction) || isFinalBookingStatus}
              id="event-booking-status"
              name="bookingStatus"
              onChange={(changeEvent) => {
                const selectedAction = lifecycleActions.find(
                  (action) => action.status === changeEvent.target.value
                );

                if (selectedAction) {
                  setPendingStatusAction(selectedAction);
                }
              }}
              value={event.bookingStatus}
            >
              <option value={event.bookingStatus}>
                {statusAction
                  ? "Saving..."
                  : getEventLifecycleStatusLabel(event.bookingStatus)}
              </option>
              {lifecycleActions.map((action) => (
                <option key={action.status} value={action.status}>
                  {action.label}
                </option>
              ))}
            </select>
            {isFinalBookingStatus ? (
              <p className="mt-1 text-xs font-normal text-[#8b95a5]">
                Lifecycle closed
              </p>
            ) : null}
          </Field>
          <Field label="Date">
            <input
              className="mt-1 h-9 w-full rounded-lg border border-[#d8dde5] bg-white px-3 text-sm font-medium text-[#17202a]"
              name="eventDate"
              onChange={(changeEvent) =>
                updateDraft("eventDate", changeEvent.target.value)
              }
              type="date"
              value={draft.eventDate}
            />
          </Field>
          <Field label="Start Time">
            <input
              className="mt-1 h-9 w-full rounded-lg border border-[#d8dde5] bg-white px-3 text-sm font-medium text-[#17202a]"
              name="eventTime"
              onChange={(changeEvent) =>
                updateDraft("eventTime", changeEvent.target.value)
              }
              type="time"
              value={draft.eventTime}
            />
          </Field>
          <Field label="Hall / Room">
            <select
              aria-label="Hall / Room"
              className="mt-1 h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm font-medium text-[#17202a]"
              name="hallId"
              onChange={(changeEvent) =>
                updateDraft("hallId", changeEvent.target.value)
              }
              value={draft.hallId}
            >
              {halls.map((hall) => (
                <option key={hall.id} value={hall.id}>
                  {hall.name}
                </option>
              ))}
            </select>
          </Field>
        </EventDetailsSection>

        <EventDetailsSection
          defaultOpen
          id="event-section-guests"
          key={`${event.id}-guests`}
          summary={guestSummary.text}
          title="Guest counts"
        >
          <Field label="Guests">
            <input
              aria-describedby={
                countErrors.guestCount ? "event-guest-count-error" : undefined
              }
              aria-invalid={countErrors.guestCount ? true : undefined}
              className="mt-1 h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm font-medium text-[#17202a]"
              id="event-guest-count"
              inputMode="decimal"
              name="guestCount"
              onChange={(changeEvent) =>
                updateDraft("guestCount", changeEvent.target.value)
              }
              type="text"
              value={draft.guestCount}
            />
            {countErrors.guestCount ? (
              <p
                className="mt-1 text-[10px] font-bold text-[#c2410c]"
                id="event-guest-count-error"
                role="alert"
              >
                {countErrors.guestCount}
              </p>
            ) : null}
          </Field>
          <Field label="Children">
            <input
              aria-describedby={
                countErrors.childrenCount
                  ? "event-children-count-error"
                  : undefined
              }
              aria-invalid={countErrors.childrenCount ? true : undefined}
              className="mt-1 h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm font-medium text-[#17202a]"
              id="event-children-count"
              inputMode="decimal"
              name="childrenCount"
              onChange={(changeEvent) =>
                updateDraft("childrenCount", changeEvent.target.value)
              }
              type="text"
              value={draft.childrenCount}
            />
            {countErrors.childrenCount ? (
              <p
                className="mt-1 text-[10px] font-bold text-[#c2410c]"
                id="event-children-count-error"
                role="alert"
              >
                {countErrors.childrenCount}
              </p>
            ) : null}
          </Field>
          <Field label="Couples">
            <input
              aria-describedby={
                countErrors.couplesCount
                  ? "event-couples-count-error"
                  : undefined
              }
              aria-invalid={countErrors.couplesCount ? true : undefined}
              className="mt-1 h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm font-medium text-[#17202a]"
              id="event-couples-count"
              inputMode="decimal"
              name="couplesCount"
              onChange={(changeEvent) =>
                updateDraft("couplesCount", changeEvent.target.value)
              }
              type="text"
              value={draft.couplesCount}
            />
            {countErrors.couplesCount ? (
              <p
                className="mt-1 text-[10px] font-bold text-[#c2410c]"
                id="event-couples-count-error"
                role="alert"
              >
                {countErrors.couplesCount}
              </p>
            ) : null}
          </Field>
        </EventDetailsSection>

        <EventDetailsSection
          defaultOpen={savedOperations.isFilled}
          forceOpen={Boolean(countErrors.waitersCount)}
          id="event-section-operations"
          key={`${event.id}-operations`}
          summary={operationsSummary.text}
          title="Operations"
        >
          <Field label="Setup time">
            <input
              className="mt-1 h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm font-medium text-[#17202a]"
              name="setupTime"
              onChange={(changeEvent) =>
                updateDraft("setupTime", changeEvent.target.value)
              }
              type="time"
              value={draft.setupTime}
            />
          </Field>
          <Field label="Washing start time">
            <input
              className="mt-1 h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm font-medium text-[#17202a]"
              name="washingTime"
              onChange={(changeEvent) =>
                updateDraft("washingTime", changeEvent.target.value)
              }
              type="time"
              value={draft.washingTime}
            />
          </Field>
          <Field label="Waiters">
            <input
              aria-describedby={
                countErrors.waitersCount ? "event-waiters-count-error" : undefined
              }
              aria-invalid={countErrors.waitersCount ? true : undefined}
              className="mt-1 h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm font-medium text-[#17202a]"
              inputMode="numeric"
              id="event-waiters-count"
              name="waitersCount"
              onChange={(changeEvent) =>
                updateDraft("waitersCount", changeEvent.target.value)
              }
              type="text"
              value={draft.waitersCount}
            />
            {countErrors.waitersCount ? (
              <p
                className="mt-1 text-[10px] font-bold text-[#c2410c]"
                id="event-waiters-count-error"
                role="alert"
              >
                {countErrors.waitersCount}
              </p>
            ) : null}
          </Field>
          <Field label="Tablecloth">
            <input
              className="mt-1 h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm font-medium text-[#17202a]"
              name="tableclothName"
              onChange={(changeEvent) =>
                updateDraft("tableclothName", changeEvent.target.value)
              }
              placeholder="Ivory, white, champagne..."
              value={draft.tableclothName}
            />
          </Field>
          <Field label="Member shul">
            <input
              className="mt-1 h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm font-medium text-[#17202a]"
              name="memberShulName"
              onChange={(changeEvent) =>
                updateDraft("memberShulName", changeEvent.target.value)
              }
              placeholder="Member shul name"
              value={draft.memberShulName}
            />
          </Field>
        </EventDetailsSection>

        <EventDetailsSection
          defaultOpen={savedNotes.isFilled}
          id="event-section-notes"
          key={`${event.id}-notes`}
          summary={notesSummary.text}
          title="Notes"
        >
          <Field label="Internal notes" className="sm:col-span-3">
            <textarea
              className="mt-1 min-h-19 w-full rounded-lg border border-[#b9c2cf] bg-white p-3 text-sm font-medium leading-5 text-[#17202a]"
              id="event-internal-notes"
              name="internalNotes"
              onChange={(changeEvent) =>
                updateDraft("internalNotes", changeEvent.target.value)
              }
              value={draft.internalNotes}
            />
          </Field>
          <Field label="Davening notes" className="sm:col-span-3">
            <textarea
              className="mt-1 min-h-19 w-full rounded-lg border border-[#b9c2cf] bg-white p-3 text-sm font-medium leading-5 text-[#17202a]"
              name="daveningNote"
              onChange={(changeEvent) =>
                updateDraft("daveningNote", changeEvent.target.value)
              }
              placeholder="Example: Shacharis after first course, Mincha before chupah, Maariv in side room."
              value={draft.daveningNote}
            />
          </Field>
          <Field label="Side boxes" className="sm:col-span-3">
            <textarea
              className="mt-1 min-h-16 w-full rounded-lg border border-[#b9c2cf] bg-white p-3 text-sm font-medium leading-5 text-[#17202a]"
              name="sideBoxes"
              onChange={(changeEvent) =>
                updateDraft("sideBoxes", changeEvent.target.value)
              }
              placeholder="Example: Men side boxes near entrance; women side boxes by stage."
              value={draft.sideBoxes}
            />
          </Field>
          <Field label="Shabbos setup" className="sm:col-span-3">
            <textarea
              className="mt-1 min-h-16 w-full rounded-lg border border-[#b9c2cf] bg-white p-3 text-sm font-medium leading-5 text-[#17202a]"
              name="shabbosSetup"
              onChange={(changeEvent) =>
                updateDraft("shabbosSetup", changeEvent.target.value)
              }
              placeholder="Example: Set before Shabbos, leave hot water urns ready."
              value={draft.shabbosSetup}
            />
          </Field>
          {event.diningManagerNotes ? (
            <div className="rounded-lg bg-[#f6f8fa] p-3 sm:col-span-3">
              <p className="text-xs font-medium text-[#6a7483]">
                Dining Manager notes
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm font-normal leading-5 text-[#17202a]">
                {event.diningManagerNotes}
              </p>
            </div>
          ) : null}
        </EventDetailsSection>
      </div>

      <div className="border-t border-[#e7ebf0] px-4 py-3">
        {hasValidationErrors ? (
          <p
            className="mb-2 text-xs font-medium leading-5 text-[#b54708]"
            role="alert"
          >
            {validationErrors[0]}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#1f4d73] px-4 text-sm font-medium text-white hover:bg-[#15344f] disabled:cursor-not-allowed disabled:opacity-40"
            disabled={isSaving || !hasUnsavedChanges || hasValidationErrors}
            type="submit"
          >
            <LineIcon name="save" className="h-4 w-4" />
            {isSaving ? "Saving..." : "Save event details"}
          </button>
          {hasUnsavedChanges ? (
            <button
              className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-[#516174] hover:bg-[#eef4fa]"
              disabled={isSaving}
              onClick={discardChanges}
              type="button"
            >
              Discard changes
            </button>
          ) : null}
          {message && !showSaveConfirmation ? (
            <p className="w-full text-xs font-normal text-[#6a7483]" role="status">
              {message}
            </p>
          ) : null}
        </div>
      </div>
    </form>
  );
}

type TimelineItem = {
  id: string;
  time: string;
  text: string;
  type: "Event" | "Kitchen" | "Staff";
};

export function timelineDisplayTimeToInputValue(time: string) {
  const trimmed = time.trim();
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(trimmed);

  if (!match) {
    return /^\d{2}:\d{2}$/.test(trimmed) ? trimmed : "12:00";
  }

  const [, hourValue, minuteValue, meridiem] = match;
  const hour = Number(hourValue);
  const normalizedHour =
    meridiem.toUpperCase() === "PM"
      ? hour === 12
        ? 12
        : hour + 12
      : hour === 12
        ? 0
        : hour;

  return `${String(normalizedHour).padStart(2, "0")}:${minuteValue}`;
}

export function timelineInputValueToDisplayTime(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return "12:00 PM";

  const [, hourValue, minuteValue] = match;
  const hour = Number(hourValue);
  const meridiem = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;

  return `${String(displayHour).padStart(2, "0")}:${minuteValue} ${meridiem}`;
}

function initialTimeline(event: EventFile): TimelineItem[] {
  const saved = event.workspaceData.timeline;
  if (Array.isArray(saved)) return saved as TimelineItem[];
  return timelineRows.map(([time, text, type], index) => ({
    id: `default-${index}`,
    time,
    text,
    type: type as TimelineItem["type"]
  }));
}

export function TimelineInstructions({ event }: { event: EventFile }) {
  const [rows, setRows] = useState<TimelineItem[]>(() =>
    initialTimeline(event)
  );
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => setRows(initialTimeline(event)), [event]);

  async function persist(confirmed: boolean) {
    setIsSaving(true);
    setMessage("");
    try {
      const response = await authenticatedFetch(`/api/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeline: rows, timelineConfirmed: confirmed })
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(result.error ?? "Could not save timeline.");
      setMessageType("success");
      setMessage(
        confirmed
        ? "Timeline confirmed. Staff can now follow this event schedule."
        : "Timeline saved. Your draft changes were saved successfully."
      );
    } catch (error) {
      setMessageType("error");
      setMessage(
        error instanceof Error ? error.message : "Could not save timeline."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section
      className="overflow-hidden rounded-lg border border-[#d8dde5] bg-white"
      id="event-timeline"
    >
      <header className="flex min-h-14 items-center justify-between gap-3 border-b border-[#d8dde5] px-3 py-2 sm:h-14 sm:px-4 sm:py-0">
        <div className="flex min-w-0 items-center gap-2">
          <LineIcon name="clock" className="h-5 w-5 shrink-0" />
          <h2 className="min-w-0 text-sm font-semibold leading-tight text-[#17202a]">
            Timeline instructions
          </h2>
        </div>
        <button
          className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm font-medium hover:bg-[#eef4fa]"
          type="button"
          onClick={() =>
            setRows((current) => [
              ...current,
              {
                id: crypto.randomUUID(),
                time: "12:00 PM",
                text: "New timeline instruction",
                type: "Event"
              }
            ])
          }
        >
          <LineIcon name="plus" className="h-5 w-5" />
          Add time
        </button>
      </header>
      <div className="space-y-3 p-3 sm:p-4">
        {rows.map((row) => (
          <div
            key={row.id}
            className="grid min-w-0 grid-cols-[142px_minmax(0,1fr)_40px] gap-2 sm:grid-cols-[112px_minmax(0,1fr)_120px_40px]"
          >
            <label
              className="flex h-11 min-w-0 cursor-text items-center justify-between rounded-lg border border-[#b9c2cf] bg-white px-2 text-sm focus-within:border-[#1f4d73] focus-within:ring-2 focus-within:ring-[#1f4d73]/15 sm:px-3"
              htmlFor={`timeline-${row.id}-time`}
            >
              <input
                aria-label={`Timeline time for ${row.text}`}
                className="min-w-24 flex-1 bg-transparent outline-none"
                id={`timeline-${row.id}-time`}
                name={`timeline-${row.id}-time`}
                type="time"
                value={timelineDisplayTimeToInputValue(row.time)}
                onChange={(changeEvent) =>
                  setRows((current) =>
                    current.map((item) =>
                      item.id === row.id
                        ? {
                            ...item,
                            time: timelineInputValueToDisplayTime(
                              changeEvent.target.value
                            )
                          }
                        : item
                    )
                  )
                }
              />
            </label>
            <input
              className="order-last col-span-3 h-11 min-w-0 w-full rounded-lg border border-[#b9c2cf] px-3 text-sm sm:order-0 sm:col-span-1"
              value={row.text}
              onChange={(changeEvent) =>
                setRows((current) =>
                  current.map((item) =>
                    item.id === row.id
                      ? { ...item, text: changeEvent.target.value }
                      : item
                  )
                )
              }
              name={`timeline-${row.id}-text`}
            />
            <select
              className="h-11 min-w-0 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm"
              value={row.type}
              onChange={(changeEvent) =>
                setRows((current) =>
                  current.map((item) =>
                    item.id === row.id
                      ? {
                          ...item,
                          type: changeEvent.target.value as TimelineItem["type"]
                        }
                      : item
                  )
                )
              }
              aria-label={`${row.time} timeline type`}
              name={`timeline-${row.id}-type`}
            >
              <option>Event</option>
              <option>Kitchen</option>
              <option>Staff</option>
            </select>
            <button
              className="flex h-11 items-center justify-center rounded-lg border border-[#b9c2cf] bg-white hover:bg-[#eef4fa]"
              type="button"
              aria-label={`Remove ${row.time}`}
              onClick={() =>
                setRows((current) =>
                  current.filter((item) => item.id !== row.id)
                )
              }
            >
              <LineIcon name="close" className="h-5 w-5" />
            </button>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 px-3 pb-3 sm:flex sm:flex-wrap sm:px-4 sm:pb-4">
        <button
          className="inline-flex h-11 min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-medium hover:bg-[#eef4fa] sm:justify-start sm:px-4 sm:text-sm"
          type="button"
          disabled={isSaving}
          onClick={() => void persist(false)}
        >
          <LineIcon name="save" />
          Save timeline
        </button>
        <button
          className="inline-flex h-11 min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[#1f4d73] px-4 text-xs font-medium text-white hover:bg-[#15344f] sm:justify-start sm:text-sm"
          type="button"
          disabled={isSaving}
          onClick={() => void persist(true)}
        >
          <LineIcon name="check" />
          Confirm timeline
        </button>
        {message ? (
          <div
            className={`col-span-2 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs font-medium sm:text-sm ${
              messageType === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
            role={messageType === "success" ? "status" : "alert"}
          >
            <LineIcon
              name={messageType === "success" ? "check" : "close"}
              className="mt-0.5 h-4 w-4 shrink-0"
            />
            <span>{message}</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
