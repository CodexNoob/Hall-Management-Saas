import { describe, expect, it } from "vitest";

import {
  createEventDetailsDraft,
  createEventDetailsDraftSignature,
  getEventLifecycleActions,
  normalizeEventStatusForSave,
  timelineDisplayTimeToInputValue,
  timelineInputValueToDisplayTime,
  validateEventDetailsDraft
} from "@/features/events/components/event-details-panel";

const event = {
  children: 4,
  clientName: "Charles Duot",
  couples: 12,
  dateInput: "2026-09-01",
  eventType: "Wedding",
  guests: 50,
  hallId: "hall-1",
  internalNotes: "Original note",
  daveningNote: "Original davening note",
  memberShulName: "Congregation Event Core",
  setupTime: "16:30",
  shabbosSetup: "Set before Shabbos.",
  sideBoxes: "Men side boxes near entrance.",
  status: "Confirmed",
  tableclothName: "Ivory",
  timeInput: "18:30",
  waitersCount: 2,
  washingTime: "22:30"
};

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

describe("event details draft signatures", () => {
  it("changes when editable event details change", () => {
    const draft = createEventDetailsDraft(event as never);
    const base = createEventDetailsDraftSignature(draft);
    const changed = createEventDetailsDraftSignature({
      ...draft,
      internalNotes: "Updated note"
    });

    expect(changed).not.toBe(base);
  });

  it("tracks davening notes as separate editable event details", () => {
    const draft = createEventDetailsDraft(event as never);
    const base = createEventDetailsDraftSignature(draft);
    const changed = createEventDetailsDraftSignature({
      ...draft,
      daveningNote: "Updated davening note"
    });

    expect(draft.daveningNote).toBe("Original davening note");
    expect(changed).not.toBe(base);
  });
});

describe("event details save normalization", () => {
  it("normalizes display event status into API values", () => {
    expect(normalizeEventStatusForSave("Confirmed")).toBe("Confirmed");
    expect(normalizeEventStatusForSave("confirmed")).toBe("Confirmed");
    expect(normalizeEventStatusForSave("Hold")).toBe("Hold");
  });
});

describe("event details form validation", () => {
  it("accepts a valid draft", () => {
    const draft = createEventDetailsDraft(event as never);

    expect(validateEventDetailsDraft(draft)).toEqual([]);
  });

  it("rejects invalid number relationships before saving", () => {
    const draft = createEventDetailsDraft(event as never);

    expect(
      validateEventDetailsDraft({
        ...draft,
        guestCount: "10",
        childrenCount: "11"
      })
    ).toContain("Children cannot be greater than total guests.");

    expect(
      validateEventDetailsDraft({
        ...draft,
        guestCount: "10",
        couplesCount: "6"
      })
    ).toContain("Couples cannot require more seats than total guests.");
  });

  it("rejects negative and non-integer count values", () => {
    const draft = createEventDetailsDraft(event as never);

    expect(
      validateEventDetailsDraft({
        ...draft,
        waitersCount: "-1"
      })
    ).toContain("Waiters must be a whole number of 0 or more.");

    expect(
      validateEventDetailsDraft({
        ...draft,
        guestCount: "10.5"
      })
    ).toContain("Guests must be a whole number of 0 or more.");
  });
});

describe("event lifecycle actions", () => {
  it("shows only valid next actions for active booking states", () => {
    expect(
      getEventLifecycleActions("INQUIRY").map((action) => action.status)
    ).toEqual(["TENTATIVE_HOLD", "CANCELLED"]);
    expect(
      getEventLifecycleActions("TENTATIVE_HOLD").map((action) => action.status)
    ).toEqual(["CONFIRMED", "CANCELLED"]);
    expect(
      getEventLifecycleActions("CONFIRMED").map((action) => action.status)
    ).toEqual(["COMPLETED", "CANCELLED"]);
  });

  it("closes lifecycle actions for final booking states", () => {
    expect(getEventLifecycleActions("COMPLETED")).toEqual([]);
    expect(getEventLifecycleActions("CANCELLED")).toEqual([]);
    expect(getEventLifecycleActions("EXPIRED")).toEqual([]);
  });
});
