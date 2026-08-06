"use client";

import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";
import {
  LineIcon,
  timelineRows,
  type EventFile,
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

export function EventInformation({ event }: { event: EventFile }) {
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function saveEvent(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setIsSaving(true);
    setMessage("");
    const formData = new FormData(formEvent.currentTarget);
    const guestCount = Number(formData.get("guestCount")) || 0;
    const childrenCount = Number(formData.get("childrenCount")) || 0;
    const couplesCount = Number(formData.get("couplesCount")) || 0;

    try {
      const response = await authenticatedFetch(`/api/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: formData.get("clientName"),
          eventType: formData.get("eventType"),
          eventStatus: formData.get("eventStatus"),
          eventDate: formData.get("eventDate"),
          couplesCount,
          kidsCount: childrenCount,
          menCount: Math.max(guestCount - childrenCount - couplesCount * 2, 0),
          notes: formData.get("internalNotes")
        })
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(result.error ?? "Could not save event.");
      setMessage("Event details saved.");
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
      className="rounded-lg border border-[#1f4d73] bg-white shadow-sm shadow-[#1f4d73]/10"
      onSubmit={saveEvent}
    >
      <header className="flex h-11 items-center gap-2 border-b border-[#d8dde5] px-4">
        <LineIcon name="calendar" />
        <h2 className="text-sm font-black text-[#17202a]">Event information</h2>
      </header>
      <div className="grid gap-3 p-3 sm:grid-cols-3">
        <Field label="Client">
          <input
            className="mt-1 h-9 w-full rounded-lg border border-[#d8dde5] bg-[#fbfcfd] px-3 text-sm font-medium text-[#17202a]"
            defaultValue={event.title.replace(" Wedding", "")}
            name="clientName"
          />
        </Field>
        <Field label="Event type">
          <input
            className="mt-1 h-9 w-full rounded-lg border border-[#d8dde5] bg-[#fbfcfd] px-3 text-sm font-medium text-[#17202a]"
            defaultValue={
              event.title.includes("Wedding") ? "Wedding" : "Dinner"
            }
            name="eventType"
          />
        </Field>
        <Field label="Status">
          <select
            className="mt-1 h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm font-medium text-[#17202a]"
            defaultValue={event.status}
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
            defaultValue={event.date}
            name="eventDate"
          />
        </Field>
        <Field label="Start Time">
          <input
            className="mt-1 h-9 w-full rounded-lg border border-[#d8dde5] bg-[#fbfcfd] px-3 text-sm font-medium text-[#17202a]"
            defaultValue={event.time}
            name="eventTime"
          />
        </Field>
        <Field label="Hall / Room">
          <input
            className="mt-1 h-9 w-full rounded-lg border border-[#d8dde5] bg-[#fbfcfd] px-3 text-sm font-medium text-[#17202a]"
            defaultValue={event.room}
            name="eventRoom"
          />
        </Field>
        <Field label="Guests">
          <input
            className="mt-1 h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm font-medium text-[#17202a]"
            defaultValue={event.guests}
            name="guestCount"
          />
        </Field>
        <Field label="Children">
          <input
            className="mt-1 h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm font-medium text-[#17202a]"
            defaultValue={event.children}
            name="childrenCount"
          />
        </Field>
        <Field label="Couples">
          <input
            className="mt-1 h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm font-medium text-[#17202a]"
            defaultValue={event.couples}
            name="couplesCount"
          />
        </Field>
        <Field label="Internal notes" className="sm:col-span-3">
          <textarea
            className="mt-1 min-h-19 w-full rounded-lg border border-[#b9c2cf] bg-white p-3 text-sm font-medium leading-5 text-[#17202a]"
            defaultValue="Confirm final layout and waiter count before the kitchen packet is printed."
            name="internalNotes"
          />
        </Field>
      </div>
      <div className="px-3 pb-3">
        <button
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white hover:bg-[#15344f]"
          disabled={isSaving}
          type="submit"
        >
          <LineIcon name="save" className="h-4 w-4" />
          {isSaving ? "Saving…" : "Save event details"}
        </button>
        {message ? (
          <p className="mt-2 text-xs text-[#516174]" role="status">
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
      setMessage(confirmed ? "Timeline confirmed." : "Timeline saved.");
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
            <div className="flex h-11 min-w-0 items-center justify-between rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm">
              <input
                aria-label="Timeline time"
                className="min-w-0 flex-1 bg-transparent outline-none"
                value={row.time}
                onChange={(changeEvent) =>
                  setRows((current) =>
                    current.map((item) =>
                      item.id === row.id
                        ? { ...item, time: changeEvent.target.value }
                        : item
                    )
                  )
                }
              />
              <LineIcon name="clock" className="h-4 w-4 shrink-0" />
            </div>
            <input
              className="order-last col-span-3 h-11 min-w-0 w-full rounded-lg border border-[#b9c2cf] px-3 text-sm sm:order-none sm:col-span-1"
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
          className="inline-flex h-11 min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[#1f4d73] px-3 text-xs font-medium text-white hover:bg-[#15344f] sm:justify-start sm:px-4 sm:text-sm"
          type="button"
          disabled={isSaving}
          onClick={() => void persist(false)}
        >
          <LineIcon name="save" />
          Save timeline
        </button>
        <button
          className="inline-flex h-11 min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[#b9c2cf] bg-white px-4 text-xs font-medium hover:bg-[#eef4fa] sm:justify-start sm:text-sm"
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
