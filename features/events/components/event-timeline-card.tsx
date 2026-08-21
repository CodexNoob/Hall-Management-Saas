"use client";

import { useEffect, useState } from "react";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";
import {
  LineIcon,
  timelineRows,
  type EventFile
} from "@/features/events/components/event-manager-shared";

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

/**
 * The rows in clock order.
 *
 * A run sheet that does not read top to bottom is not a run sheet, and rows are
 * appended as they are added rather than in the order they happen. Sorting on
 * the 24-hour form keeps the afternoon after the morning, which sorting the
 * displayed "03:00 PM" text would not.
 */
export function sortTimelineRows(rows: TimelineItem[]) {
  return [...rows].sort((left, right) =>
    timelineDisplayTimeToInputValue(left.time).localeCompare(
      timelineDisplayTimeToInputValue(right.time)
    )
  );
}

function initialTimeline(event: EventFile): TimelineItem[] {
  const saved = event.workspaceData.timeline;

  if (Array.isArray(saved)) return sortTimelineRows(saved as TimelineItem[]);

  return sortTimelineRows(
    timelineRows.map(([time, text, type], index) => ({
      id: `default-${index}`,
      time,
      text,
      type: type as TimelineItem["type"]
    }))
  );
}

/**
 * The day-of schedule, kept beside the booking record rather than on a tab of
 * its own.
 *
 * Its times only mean anything against the event's own date and start time, so
 * it stays on the same tab as the form holding them. What it does not share is
 * a lifecycle: this card saves and confirms separately, so it carries its own
 * confirmed chip and mirrors the event form's button order - solid for save,
 * outlined for the one-time confirm - rather than inverting it and leaving two
 * different solid buttons to be told apart by their labels alone.
 */
export function TimelineInstructions({
  event,
  onEventSaved
}: {
  event: EventFile;
  onEventSaved: () => Promise<unknown>;
}) {
  const [rows, setRows] = useState<TimelineItem[]>(() =>
    initialTimeline(event)
  );
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">(
    "success"
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => setRows(initialTimeline(event)), [event]);

  // Whatever the last save said is about the event that was open at the time,
  // so it is dropped when a different one is selected.
  useEffect(() => setMessage(""), [event.id]);

  const isConfirmed = event.workspaceData.timelineConfirmed === true;

  function updateRow(id: string, patch: Partial<TimelineItem>) {
    setRows((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }

  async function persist(confirmed: boolean) {
    // Sorted before it leaves, so what staff read back is what the card shows.
    const ordered = sortTimelineRows(rows);

    setRows(ordered);
    setIsSaving(true);
    setMessage("");

    try {
      const response = await authenticatedFetch(`/api/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timeline: ordered,
          timelineConfirmed: confirmed
        })
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok)
        throw new Error(result.error ?? "Could not save timeline.");

      // Readiness and the confirmed chip both read the stored event, so they
      // only catch up once the saved row has been refetched.
      await onEventSaved();
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
    // A container, not a viewport: this card sits in a column that is narrow
    // long before the window is, so its rows have to break on their own width.
    // Sized off the viewport they stayed four across in a 370px column and the
    // instruction field was left too narrow to read its own text.
    <section className="@container overflow-hidden rounded-xl border border-[#d8dde5] bg-white">
      <header className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-[#d8dde5] px-3 py-2 @lg:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <LineIcon name="clock" className="h-5 w-5 shrink-0" />
          <div className="min-w-0">
            <h2 className="min-w-0 text-sm font-black leading-tight text-[#17202a] @lg:text-base">
              Timeline instructions
            </h2>
            <p className="mt-0.5 text-xs font-semibold leading-4 text-[#64748b]">
              What staff and the kitchen follow on the day.
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${
              isConfirmed
                ? "bg-[#eefaf5] text-[#146c43]"
                : "bg-[#fff8dd] text-[#946200]"
            }`}
          >
            {isConfirmed ? "Confirmed" : "Draft"}
          </span>
        </div>
        <button
          className="inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm font-medium hover:bg-[#eef4fa]"
          type="button"
          onClick={() =>
            setRows((current) => [
              ...current,
              {
                id: crypto.randomUUID(),
                // Added after the last thing that happens, so the new row lands
                // at the bottom without the sort moving it out from under the
                // cursor. A fixed noon default would drop it mid-list.
                time: current.at(-1)?.time ?? "12:00 PM",
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

      <div className="space-y-3 p-3 @lg:p-4">
        {rows.map((row) => (
          <div
            key={row.id}
            className="grid min-w-0 grid-cols-[142px_minmax(0,1fr)_40px] gap-2 @lg:grid-cols-[112px_minmax(0,1fr)_120px_40px]"
          >
            <label
              className="flex h-11 min-w-0 cursor-text items-center justify-between rounded-lg border border-[#b9c2cf] bg-white px-2 text-sm focus-within:border-[#1f4d73] focus-within:ring-2 focus-within:ring-[#1f4d73]/15 @lg:px-3"
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
                  updateRow(row.id, {
                    time: timelineInputValueToDisplayTime(
                      changeEvent.target.value
                    )
                  })
                }
                // Reordered once the field is done rather than per keystroke,
                // which would pull the row away mid-edit.
                onBlur={() => setRows(sortTimelineRows)}
              />
            </label>
            <input
              className="order-last col-span-3 h-11 w-full min-w-0 rounded-lg border border-[#b9c2cf] px-3 text-sm @lg:order-0 @lg:col-span-1"
              value={row.text}
              onChange={(changeEvent) =>
                updateRow(row.id, { text: changeEvent.target.value })
              }
              name={`timeline-${row.id}-text`}
            />
            <select
              className="h-11 w-full min-w-0 rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm"
              value={row.type}
              onChange={(changeEvent) =>
                updateRow(row.id, {
                  type: changeEvent.target.value as TimelineItem["type"]
                })
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

      <div className="flex flex-wrap items-center gap-2 px-3 pb-3 @lg:px-4 @lg:pb-4">
        <button
          className="inline-flex h-11 min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white hover:bg-[#15344f] disabled:cursor-not-allowed disabled:opacity-45 @lg:text-sm"
          type="button"
          disabled={isSaving}
          onClick={() => void persist(false)}
        >
          <LineIcon name="save" className="h-4 w-4" />
          {isSaving ? "Saving..." : "Save timeline"}
        </button>
        <button
          className="inline-flex h-11 min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[#b9c2cf] bg-white px-4 text-xs font-black text-[#17202a] hover:bg-[#eef4fa] disabled:cursor-not-allowed disabled:opacity-45 @lg:text-sm"
          type="button"
          disabled={isSaving || isConfirmed}
          title={
            isConfirmed
              ? "This timeline is already confirmed."
              : "Save this schedule and confirm it for staff"
          }
          onClick={() => void persist(true)}
        >
          <LineIcon name="check" className="h-4 w-4" />
          Confirm timeline
        </button>

        {message ? (
          <div
            className={`flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-xs font-bold ${
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
