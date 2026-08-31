import { describe, expect, it } from "vitest";
import {
  bookingFormSchema,
  emptyBookingFormValues,
  fieldErrorPatch,
  toGuestCountPayload,
  type BookingFormValues
} from "@/features/bookings/validations/booking-form.schema";

const base = {
  clientName: "Sample",
  phone: "9179405780",
  eventDate: "2026-08-27",
  hallId: "11111111-1111-4111-8111-111111111111",
  eventTypeId: "22222222-2222-4222-8222-222222222222",
  notes: ""
};

function form(overrides: Partial<BookingFormValues> = {}): BookingFormValues {
  return { ...emptyBookingFormValues, ...base, ...overrides };
}

function counts(values: BookingFormValues) {
  const parsed = bookingFormSchema().safeParse(values);

  if (!parsed.success) {
    throw new Error(
      `expected a valid form, got: ${parsed.error.issues
        .map((issue) => issue.message)
        .join(", ")}`
    );
  }

  return toGuestCountPayload(parsed.data);
}

describe("counting in couples", () => {
  it("stores the pairs and leaves the catch-all empty", () => {
    expect(
      counts(form({ countMode: "Couples", couples: "110", children: "35" }))
    ).toMatchObject({ couplesCount: 110, kidsCount: 35, menCount: 0 });
  });

  it("ignores a head count left behind by an earlier mode", () => {
    // 250 was typed in People mode and is still in the box, off screen. It is
    // not the event's count any more, and must not reach the database.
    expect(
      counts(
        form({
          countMode: "Couples",
          guests: "250",
          couples: "110",
          children: "35"
        })
      )
    ).toMatchObject({ couplesCount: 110, kidsCount: 35, menCount: 0 });
  });

  it("does not complain that a hidden total fails to cover the parts", () => {
    // The exact state the client hit: 250 guests beside 110 couples and 35
    // children. In Couples mode there is no total to be wrong.
    const parsed = bookingFormSchema().safeParse(
      form({
        countMode: "Couples",
        guests: "250",
        couples: "110",
        children: "35"
      })
    );

    expect(parsed.success).toBe(true);
  });
});

describe("counting by head", () => {
  it("puts the adults in the catch-all and keeps the total intact", () => {
    // 250 in the room, 35 of them children.
    expect(
      counts(form({ countMode: "People", guests: "250", children: "35" }))
    ).toMatchObject({ couplesCount: 0, kidsCount: 35, menCount: 215 });
  });

  it("ignores couples left behind by an earlier mode", () => {
    expect(
      counts(
        form({
          countMode: "People",
          guests: "250",
          couples: "110",
          children: "35"
        })
      )
    ).toMatchObject({ couplesCount: 0, kidsCount: 35, menCount: 215 });
  });

  it("still refuses a total smaller than its own children", () => {
    const parsed = bookingFormSchema().safeParse(
      form({ countMode: "People", guests: "20", children: "35" })
    );

    expect(parsed.success).toBe(false);

    if (parsed.success) return;

    expect(parsed.error.issues[0]?.path).toEqual(["guests"]);
  });
});

describe("fieldErrorPatch", () => {
  it("retires the guests complaint when the children or the mode move", () => {
    expect(fieldErrorPatch("children")).toMatchObject({
      children: undefined,
      guests: undefined
    });
    expect(fieldErrorPatch("countMode")).toMatchObject({
      countMode: undefined,
      guests: undefined
    });
  });

  it("leaves other fields' messages standing", () => {
    expect(fieldErrorPatch("clientName")).toEqual({ clientName: undefined });
  });
});
