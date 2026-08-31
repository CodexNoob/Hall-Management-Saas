import { describe, expect, it } from "vitest";

import {
  createBookingFormValues,
  toEventDetailsPayload
} from "@/features/events/components/event-details-panel";
import {
  sortTimelineRows,
  timelineDisplayTimeToInputValue,
  timelineInputValueToDisplayTime
} from "@/features/events/components/event-timeline-card";
import { bookingFormSchema } from "@/features/bookings/validations/booking-form.schema";

const event = {
  children: "4",
  clientName: "Charles Duot",
  couples: "12",
  dateInput: "2026-09-01",
  eventType: "Wedding",
  eventTypeId: "3f2a1b4c-5d6e-4f70-8a91-b2c3d4e5f607",
  guests: "50",
  hallId: "3f2a1b4c-5d6e-4f70-8a91-b2c3d4e5f601",
  internalNotes: "Original note",
  phone: "+12125550123",
  email: "charles@example.com",
  coordinatorMembershipId: "3f2a1b4c-5d6e-4f70-8a91-b2c3d4e5f608",
  status: "Confirmed",
  timeInput: "18:30"
};

function parseValues(values: ReturnType<typeof createBookingFormValues>) {
  const result = bookingFormSchema({ country: "US" }).safeParse(values);

  if (!result.success) {
    throw new Error(JSON.stringify(result.error.flatten().fieldErrors));
  }

  return result.data;
}

describe("event timeline time conversion", () => {
  it("converts display time into a native time input value", () => {
    expect(timelineDisplayTimeToInputValue("03:00 PM")).toBe("15:00");
    expect(timelineDisplayTimeToInputValue("12:30 AM")).toBe("00:30");
    expect(timelineDisplayTimeToInputValue("12:30 PM")).toBe("12:30");
  });

  it("converts native time input value back into display time", () => {
    expect(timelineInputValueToDisplayTime("15:00")).toBe("03:00 PM");
    expect(timelineInputValueToDisplayTime("00:30")).toBe("12:30 AM");
    expect(timelineInputValueToDisplayTime("12:30")).toBe("12:30 PM");
  });
});

describe("event timeline ordering", () => {
  const row = (time: string) => ({
    id: time,
    time,
    text: time,
    type: "Event" as const
  });
  const cue = (id: string, waitsOn: string) => ({
    id,
    time: "",
    cue: waitsOn,
    text: id,
    type: "Kitchen" as const
  });

  it("reads top to bottom in clock order", () => {
    const sorted = sortTimelineRows([
      row("10:45 PM"),
      row("12:00 PM"),
      row("03:00 PM"),
      row("12:30 AM")
    ]);

    expect(sorted.map((item) => item.time)).toEqual([
      "12:30 AM",
      "12:00 PM",
      "03:00 PM",
      "10:45 PM"
    ]);
  });

  it("leaves the rows it was given untouched", () => {
    const rows = [row("10:45 PM"), row("03:00 PM")];

    sortTimelineRows(rows);

    expect(rows.map((item) => item.time)).toEqual(["10:45 PM", "03:00 PM"]);
  });

  it("keeps a cue directly under the course it waits on", () => {
    const sorted = sortTimelineRows([
      row("10:45 PM"),
      row("06:30 PM"),
      cue("beer", "After the soup"),
      row("03:00 PM")
    ]);

    expect(sorted.map((item) => item.id)).toEqual([
      "03:00 PM",
      "06:30 PM",
      "beer",
      "10:45 PM"
    ]);
  });

  // The whole point of a cue: the soup runs an hour late, and the beer that
  // waits on it goes late too rather than staying at the time it was typed.
  it("carries a cue along when the course it waits on moves", () => {
    const sorted = sortTimelineRows([
      row("11:00 PM"),
      cue("beer", "After the soup"),
      row("10:45 PM")
    ]);

    expect(sorted.map((item) => item.id)).toEqual([
      "10:45 PM",
      "11:00 PM",
      "beer"
    ]);
  });

  it("keeps two cues on one course in the order they were typed", () => {
    const sorted = sortTimelineRows([
      row("06:30 PM"),
      cue("beer", "After the soup"),
      cue("cake", "After the beer")
    ]);

    expect(sorted.map((item) => item.id)).toEqual([
      "06:30 PM",
      "beer",
      "cake"
    ]);
  });

  it("leaves a cue written above every time at the top", () => {
    const sorted = sortTimelineRows([
      cue("doors", "When the hall opens"),
      row("03:00 PM")
    ]);

    expect(sorted.map((item) => item.id)).toEqual(["doors", "03:00 PM"]);
  });
});

describe("event information booking form values", () => {
  it("reads a stored event into the booking form fields", () => {
    const values = createBookingFormValues(event as never);

    expect(values).toEqual({
      clientName: "Charles Duot",
      // Stored as E.164, typed as the national part.
      phone: "(212) 555-0123",
      email: "charles@example.com",
      coordinatorMembershipId: "3f2a1b4c-5d6e-4f70-8a91-b2c3d4e5f608",
      eventDate: "2026-09-01",
      hallId: "3f2a1b4c-5d6e-4f70-8a91-b2c3d4e5f601",
      eventTypeId: "3f2a1b4c-5d6e-4f70-8a91-b2c3d4e5f607",
      // 50 is more than the 12 couples and 4 children account for, so this room
      // was not counted in pairs and opens by head.
      countMode: "People",
      guests: "50",
      couples: "12",
      children: "4",
      notes: "Original note"
    });
  });

  it("passes the shared booking schema", () => {
    expect(() => parseValues(createBookingFormValues(event as never))).not.toThrow();
  });
});

describe("event information save payload", () => {
  it("resaves a head-counted event without losing anyone", () => {
    const payload = toEventDetailsPayload(
      parseValues(createBookingFormValues(event as never)),
      event.timeInput
    );

    expect(payload).toMatchObject({
      clientName: "Charles Duot",
      eventDate: "2026-09-01",
      // Booked before the count modes existed, so it holds couples beside a
      // head count. Reopened it counts by head, and the couples it also carried
      // fold into the total rather than being counted a second time.
      couplesCount: 0,
      kidsCount: 4,
      boysCount: 0,
      girlsCount: 0,
      ladiesCount: 0,
      // 50 in the room, 4 of them children. The total survives the resave.
      menCount: 46
    });
  });

  it("sends nothing the Client contact card owns", () => {
    // The panel holds these values - they arrive with the event and sit in its
    // form state - but the card is the only thing that saves them. A panel that
    // sent its copy would put a stale phone back over an edit made next to it,
    // on a save of something else entirely.
    const payload = toEventDetailsPayload(
      parseValues(createBookingFormValues(event as never)),
      event.timeInput
    );

    expect(payload).not.toHaveProperty("phone");
    expect(payload).not.toHaveProperty("email");
    expect(payload).not.toHaveProperty("coordinatorMembershipId");
  });

  it("carries the stored clock time onto a moved date", () => {
    const values = {
      ...createBookingFormValues(event as never),
      eventDate: "2026-09-08"
    };
    const payload = toEventDetailsPayload(parseValues(values), "18:30");

    expect(payload.startsAt).toBe(
      new Date("2026-09-08T18:30:00").toISOString()
    );
  });

  it("leaves an event with no recorded time without one", () => {
    const payload = toEventDetailsPayload(
      parseValues(createBookingFormValues(event as never)),
      ""
    );

    expect(payload).not.toHaveProperty("startsAt");
  });
});
