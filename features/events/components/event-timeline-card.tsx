"use client";

import { useEffect, useState } from "react";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";
import {
  LineIcon,
  type EventFile
} from "@/features/events/components/event-manager-shared";

type TimelineItem = {
  id: string;
  time: string;
  /**
   * What the row waits on instead of a clock - "after the soup is served".
   *
   * Events run late, and the instructions that matter most are the ones that
   * have to happen in sequence regardless of the hour: the beer goes out after
   * the soup whether the soup landed at 9:30 or at 10:40.
   *
   * Its presence rather than its content is what makes a row cue-driven, so a
   * cue nobody has typed yet is still a cue row. An empty string therefore has
   * to survive the round trip, or a half-filled row would read back as a
   * midnight time row and jump to the top of the sheet.
   */
  cue?: string;
  text: string;
  type: "Event" | "Kitchen" | "Staff";
};

export function isCueRow(
  row: TimelineItem
): row is TimelineItem & { cue: string } {
  return typeof row.cue === "string";
}

export function timelineDisplayTimeToInputValue(time: string | undefined) {
  const trimmed = (time ?? "").trim();
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
 * The clock time each row hangs from: its own if it has one, and otherwise the
 * one belonging to the nearest timed row above it.
 *
 * A cue row owns no time, but it still has to land somewhere, and the row it
 * was written under is the only honest answer - "after the soup is served"
 * means nothing parked at the far end of the sheet, away from the course it
 * waits on.
 */
function timelineAnchors(rows: TimelineItem[]) {
  const anchors = new Map<string, string>();
  // Midnight, so a cue written above every timed row stays above them rather
  // than sinking to wherever the default happened to fall.
  let anchor = "00:00";

  rows.forEach((row) => {
    if (!isCueRow(row)) anchor = timelineDisplayTimeToInputValue(row.time);
    anchors.set(row.id, anchor);
  });

  return anchors;
}

/**
 * The rows in running order.
 *
 * A run sheet that does not read top to bottom is not a run sheet, and rows are
 * appended as they are added rather than in the order they happen. Sorting on
 * the 24-hour form keeps the afternoon after the morning, which sorting the
 * displayed "03:00 PM" text would not.
 *
 * Sorting on the anchor rather than on the row's own time is what keeps a cue
 * pinned under the course it follows, including when that course moves: push
 * the soup an hour later and the beer goes with it.
 */
export function sortTimelineRows(rows: TimelineItem[]) {
  const anchors = timelineAnchors(rows);

  // Stable, so a timed row and the cues waiting on it keep the order they were
  // typed in instead of trading places every time the sheet is re-sorted.
  return [...rows].sort((left, right) =>
    (anchors.get(left.id) ?? "").localeCompare(anchors.get(right.id) ?? "")
  );
}

/**
 * The row's other kind of "when".
 *
 * Switching a cue back to the clock needs a time to switch back to, and the
 * anchor it was already sitting on is the one that leaves it where the manager
 * last saw it. Falling back to a fixed noon instead would fling the row into
 * the middle of the sheet the moment the mode changed.
 */
function toggleWhen(row: TimelineItem, anchor: string): Partial<TimelineItem> {
  return isCueRow(row)
    ? { cue: undefined, time: timelineInputValueToDisplayTime(anchor) }
    : { cue: "", time: "" };
}

/**
 * What the card opens on: the saved sheet, and otherwise nothing.
 *
 * A new booking starts empty rather than on a sample schedule. Prefilled rows
 * read as a real timeline the moment the tab opens - they carry times and a
 * Kitchen line staff would act on - so a manager who never touched the card
 * could confirm somebody else's dinner service for their own event.
 */
function initialTimeline(event: EventFile): TimelineItem[] {
  const saved = event.workspaceData.timeline;

  if (Array.isArray(saved)) return sortTimelineRows(saved as TimelineItem[]);

  return [];
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
  // Read here rather than inside the toggle so flipping a cue back to the clock
  // can hand it the time it is already sitting under.
  const anchors = timelineAnchors(rows);

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
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            className="inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm font-medium hover:bg-[#eef4fa]"
            type="button"
            onClick={() =>
              setRows((current) => [
                ...current,
                {
                  id: crypto.randomUUID(),
                  // Added after the last thing that happens, so the new row
                  // lands at the bottom without the sort moving it out from
                  // under the cursor. A fixed noon default would drop it
                  // mid-list.
                  //
                  // The last *timed* row, not simply the last one: a cue row
                  // carries no time to copy, so ending the sheet on one would
                  // hand this row a blank and send it back up to midnight.
                  time:
                    current.findLast((item) => !isCueRow(item))?.time ??
                    "12:00 PM",
                  text: "New timeline instruction",
                  type: "Event"
                }
              ])
            }
          >
            <LineIcon name="plus" className="h-5 w-5" />
            Add time
          </button>
          <button
            className="inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm font-medium hover:bg-[#eef4fa]"
            type="button"
            title="Add an instruction that waits on something else, such as after the soup is served."
            onClick={() =>
              setRows((current) => [
                ...current,
                {
                  id: crypto.randomUUID(),
                  // Blank, and it stays blank: the cue carries the "when", and
                  // the anchor sort keeps this row under whatever it was added
                  // beneath.
                  time: "",
                  cue: "",
                  text: "New timeline instruction",
                  type: "Event"
                }
              ])
            }
          >
            <LineIcon name="plus" className="h-5 w-5" />
            Add cue
          </button>
        </div>
      </header>

      <div className="space-y-3 p-3 @lg:p-4">
        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[#b9c2cf] px-3 py-4 text-center text-xs font-semibold text-[#64748b]">
            No timeline instructions yet. Add a time for something that happens
            at a set hour, or a cue for something that waits on another step.
          </p>
        ) : null}
        {rows.map((row) => (
          <div
            key={row.id}
            className="grid min-w-0 grid-cols-[minmax(0,1fr)_112px_40px] gap-2 @lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_120px_40px]"
          >
            {/* One cell for the "when", whichever kind it is. Kept on a single
                shared column template rather than a wider one for cues, so the
                sheet still reads as aligned columns down the page. */}
            <div className="flex h-11 min-w-0 items-center gap-1 rounded-lg border border-[#b9c2cf] bg-white px-1 text-sm focus-within:border-[#1f4d73] focus-within:ring-2 focus-within:ring-[#1f4d73]/15">
              <button
                aria-label={
                  isCueRow(row)
                    ? `Give ${row.text} a clock time instead of a cue`
                    : `Give ${row.text} a cue instead of a clock time`
                }
                className="flex h-8 w-7 shrink-0 items-center justify-center rounded-md text-[#64748b] hover:bg-[#eef4fa] hover:text-[#17202a]"
                title={
                  isCueRow(row)
                    ? "Waits on something else. Switch to a clock time."
                    : "Runs at a clock time. Switch to a cue."
                }
                type="button"
                onClick={() =>
                  updateRow(
                    row.id,
                    toggleWhen(row, anchors.get(row.id) ?? "00:00")
                  )
                }
              >
                <LineIcon
                  name={isCueRow(row) ? "chevron" : "clock"}
                  className="h-4 w-4"
                />
              </button>
              {isCueRow(row) ? (
                <input
                  aria-label={`Timeline cue for ${row.text}`}
                  className="min-w-0 flex-1 bg-transparent outline-none"
                  id={`timeline-${row.id}-cue`}
                  name={`timeline-${row.id}-cue`}
                  placeholder="After the soup"
                  value={row.cue}
                  onChange={(changeEvent) =>
                    updateRow(row.id, { cue: changeEvent.target.value })
                  }
                />
              ) : (
                <input
                  aria-label={`Timeline time for ${row.text}`}
                  className="min-w-0 flex-1 bg-transparent outline-none"
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
              )}
            </div>
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
              aria-label={`${row.text} timeline type`}
              name={`timeline-${row.id}-type`}
            >
              <option>Event</option>
              <option>Kitchen</option>
              <option>Staff</option>
            </select>
            <button
              className="flex h-11 items-center justify-center rounded-lg border border-[#b9c2cf] bg-white hover:bg-[#eef4fa]"
              type="button"
              // Named for the instruction rather than the time: a cue row has
              // no time to be named after.
              aria-label={`Remove ${row.text}`}
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
