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
import {
  LineIcon,
  timelineRows,
  type EventFile,
  type EventHallOption,
  type IconName
} from "@/features/events/components/event-manager-shared";

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
    <label
      className={`block text-[11px] font-black uppercase tracking-[0.08em] text-[#6a7483] ${className}`}
    >
      {label}
      {children}
    </label>
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
        <h2 className="text-sm font-black text-[#17202a]">Client contact</h2>
      </header>
      <div className="space-y-3 p-3">
        {rows.map((row) => (
          <a
            key={row.label}
            className={`flex h-12 w-full items-center gap-3 rounded-lg border border-[#d8dde5] bg-white px-3 text-left text-sm font-black text-[#17202a] ${row.href ? "hover:bg-[#eef4fa]" : "cursor-default"}`}
            href={row.href}
            aria-disabled={!row.href}
            onClick={(clickEvent) => {
              if (!row.href) clickEvent.preventDefault();
            }}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#d8dde5] bg-[#fbfcfd] text-[#1f4d73]">
              <LineIcon name={row.icon} />
            </span>
            <span className="min-w-0 flex-1 truncate">{row.label}</span>
            {row.href ? (
              <LineIcon name="chevron" className="h-4 w-4 text-[#17202a]" />
            ) : null}
          </a>
        ))}
      </div>
    </section>
  );
}

export function ReadinessPanel() {
  const rows = [
    ["Event confirmed", true],
    ["Menu confirmed", true],
    ["Hall map confirmed", false],
    ["Timeline confirmed", false],
    ["Event paid", false]
  ] as const;

  return (
    <section className="rounded-lg border border-[#d8dde5] bg-white">
      <header className="flex h-11 items-center gap-2 border-b border-[#d8dde5] px-4">
        <LineIcon name="files" />
        <h2 className="text-sm font-black text-[#17202a]">Readiness</h2>
      </header>
      <div className="space-y-3 p-3">
        {rows.map(([label, done]) => (
          <div
            key={label}
            className="flex h-12 items-center gap-3 rounded-lg border border-[#d8dde5] bg-white px-3 text-sm font-black text-[#17202a]"
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full border ${done ? "border-[#146c43] text-[#146c43]" : "border-[#b9c2cf] text-transparent"}`}
            >
              {done ? <LineIcon name="check" className="h-4 w-4" /> : null}
            </span>
            {label}
          </div>
        ))}
      </div>
    </section>
  );
}

type EventDetailsDraft = {
  childrenCount: number;
  clientName: string;
  couplesCount: number;
  eventDate: string;
  eventStatus: string;
  eventTime: string;
  eventType: string;
  guestCount: number;
  hallId: string;
  internalNotes: string;
};

export function createEventDetailsDraft(event: EventFile): EventDetailsDraft {
  return {
    childrenCount: Number(event.children) || 0,
    clientName: event.clientName,
    couplesCount: Number(event.couples) || 0,
    eventDate: event.dateInput,
    eventStatus: event.status,
    eventTime: event.timeInput,
    eventType: event.eventType,
    guestCount: Number(event.guests) || 0,
    hallId: event.hallId,
    internalNotes: event.internalNotes
  };
}

export function createEventDetailsDraftSignature(draft: EventDetailsDraft) {
  return JSON.stringify(draft);
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
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const saveConfirmationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const previousEventIdRef = useRef(event.id);
  const savedDraftSignature = useMemo(
    () => createEventDetailsDraftSignature(createEventDetailsDraft(event)),
    [event]
  );
  const currentDraftSignature = useMemo(
    () => createEventDetailsDraftSignature(draft),
    [draft]
  );
  const hasUnsavedChanges = currentDraftSignature !== savedDraftSignature;

  useEffect(() => {
    const didSwitchEvent = previousEventIdRef.current !== event.id;
    previousEventIdRef.current = event.id;

    setDraft(createEventDetailsDraft(event));
    setMessage("");
    if (didSwitchEvent) {
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
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function discardChanges() {
    setDraft(createEventDetailsDraft(event));
    setShowSaveConfirmation(false);
    setMessage("Unsaved event detail changes discarded.");
  }

  async function saveEvent(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setIsSaving(true);
    setMessage("");
    const guestCount = draft.guestCount || 0;
    const childrenCount = draft.childrenCount || 0;
    const couplesCount = draft.couplesCount || 0;
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
          notes: draft.internalNotes
        })
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(result.error ?? "Could not save event.");
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

  return (
    <form
      className="relative rounded-lg border border-[#1f4d73] bg-white shadow-sm shadow-[#1f4d73]/10"
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
      <header className="flex h-11 items-center gap-2 border-b border-[#d8dde5] px-4">
        <LineIcon name="calendar" />
        <h2 className="text-sm font-black text-[#17202a]">Event information</h2>
        {hasUnsavedChanges ? (
          <span className="ml-auto rounded-full border border-[#fedf89] bg-[#fffbeb] px-3 py-1 text-[10px] font-black uppercase tracking-wide text-[#b54708]">
            Unsaved changes
          </span>
        ) : null}
      </header>
      <div className="grid gap-3 p-3 sm:grid-cols-3">
        <Field label="Client">
            <input
              className="mt-1 h-9 w-full rounded-lg border border-[#d8dde5] bg-[#fbfcfd] px-3 text-sm font-medium text-[#17202a]"
            onChange={(changeEvent) =>
              updateDraft("clientName", changeEvent.target.value)
            }
            value={draft.clientName}
            name="clientName"
          />
        </Field>
        <Field label="Event type">
            <input
              className="mt-1 h-9 w-full rounded-lg border border-[#d8dde5] bg-[#fbfcfd] px-3 text-sm font-medium text-[#17202a]"
            onChange={(changeEvent) =>
              updateDraft("eventType", changeEvent.target.value)
            }
            value={draft.eventType}
            name="eventType"
          />
        </Field>
        <Field label="Status">
          <select
            className="mt-1 h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm font-medium text-[#17202a]"
            onChange={(changeEvent) =>
              updateDraft("eventStatus", changeEvent.target.value)
            }
            value={draft.eventStatus}
            aria-label="Event status"
            name="eventStatus"
          >
            <option>Confirmed</option>
            <option>Hold</option>
          </select>
        </Field>
        <Field label="Date">
            <input
              className="mt-1 h-9 w-full rounded-lg border border-[#d8dde5] bg-[#fbfcfd] px-3 text-sm font-medium text-[#17202a]"
            onChange={(changeEvent) =>
              updateDraft("eventDate", changeEvent.target.value)
            }
            value={draft.eventDate}
            name="eventDate"
            type="date"
          />
        </Field>
        <Field label="Start Time">
            <input
              className="mt-1 h-9 w-full rounded-lg border border-[#d8dde5] bg-[#fbfcfd] px-3 text-sm font-medium text-[#17202a]"
            onChange={(changeEvent) =>
              updateDraft("eventTime", changeEvent.target.value)
            }
            value={draft.eventTime}
            name="eventTime"
            type="time"
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
        <Field label="Guests">
          <input
            className="mt-1 h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm font-medium text-[#17202a]"
            onChange={(changeEvent) =>
              updateDraft("guestCount", Number(changeEvent.target.value))
            }
            type="number"
            value={draft.guestCount}
            name="guestCount"
          />
        </Field>
        <Field label="Children">
          <input
            className="mt-1 h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm font-medium text-[#17202a]"
            name="childrenCount"
            onChange={(changeEvent) =>
              updateDraft("childrenCount", Number(changeEvent.target.value))
            }
            type="number"
            value={draft.childrenCount}
          />
        </Field>
        <Field label="Couples">
          <input
            className="mt-1 h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm font-medium text-[#17202a]"
            name="couplesCount"
            onChange={(changeEvent) =>
              updateDraft("couplesCount", Number(changeEvent.target.value))
            }
            type="number"
            value={draft.couplesCount}
          />
        </Field>
        <Field label="Internal notes" className="sm:col-span-3">
          <textarea
            className="mt-1 min-h-19 w-full rounded-lg border border-[#b9c2cf] bg-white p-3 text-sm font-medium leading-5 text-[#17202a]"
            name="internalNotes"
            onChange={(changeEvent) =>
              updateDraft("internalNotes", changeEvent.target.value)
            }
            value={draft.internalNotes}
          />
        </Field>
        {event.diningManagerNotes ? (
          <section className="rounded-lg border border-[#b9c2cf] bg-[#f8fafc] p-3 sm:col-span-3">
            <h3 className="text-[11px] font-black uppercase tracking-[0.08em] text-[#6a7483]">
              Dining Manager notes
            </h3>
            <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-5 text-[#17202a]">
              {event.diningManagerNotes}
            </p>
          </section>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2 px-3 pb-3">
        {hasUnsavedChanges ? (
          <button
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#b9c2cf] bg-white px-4 text-xs font-black text-[#17202a] hover:bg-[#eef4fa]"
            disabled={isSaving}
            onClick={discardChanges}
            type="button"
          >
            Discard changes
          </button>
        ) : null}
        <button
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white hover:bg-[#15344f] disabled:cursor-not-allowed disabled:opacity-45"
          disabled={isSaving || !hasUnsavedChanges}
          type="submit"
        >
          <LineIcon name="save" className="h-4 w-4" />
          {isSaving ? "Saving..." : "Save event details"}
        </button>
        {message && !showSaveConfirmation ? (
          <p className="w-full text-xs text-[#516174]" role="status">
            {message}
          </p>
        ) : null}
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
      setMessage(
        confirmed
          ? "Timeline confirmed and ready for event operations."
          : "Timeline saved as a draft."
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not save timeline."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white">
      <header className="flex min-h-14 items-center justify-between gap-3 border-b border-[#d8dde5] px-3 py-2 sm:h-14 sm:px-4 sm:py-0">
        <div className="flex min-w-0 items-center gap-2">
          <LineIcon name="clock" className="h-5 w-5 shrink-0" />
          <h2 className="min-w-0 text-sm font-black leading-tight text-[#17202a] sm:text-base">
            Timeline instructions
          </h2>
        </div>
        <button
          className="inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm font-medium hover:bg-[#eef4fa]"
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
            className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_40px] gap-2 sm:grid-cols-[112px_minmax(0,1fr)_120px_40px]"
          >
            <label
              className="flex h-11 min-w-0 cursor-text items-center justify-between rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm focus-within:border-[#1f4d73] focus-within:ring-2 focus-within:ring-[#1f4d73]/15"
              htmlFor={`timeline-${row.id}-time`}
            >
              <input
                aria-label={`Timeline time for ${row.text}`}
                className="min-w-0 flex-1 bg-transparent outline-none"
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
              <LineIcon
                name="clock"
                className="h-4 w-4 shrink-0 text-[#516174]"
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
          <p className="col-span-2 text-xs text-[#516174]" role="status">
            {message}
          </p>
        ) : null}
      </div>
    </section>
  );
}
