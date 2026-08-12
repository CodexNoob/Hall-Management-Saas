import { describe, expect, it } from "vitest";

import {
  createEventDetailsDraft,
  createEventDetailsDraftSignature,
  normalizeEventStatusForSave,
  timelineDisplayTimeToInputValue,
  timelineInputValueToDisplayTime
} from "@/features/events/components/event-details-panel";

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
  const event = {
    children: 4,
    clientName: "Charles Duot",
    couples: 12,
    dateInput: "2026-09-01",
    eventType: "Wedding",
    guests: 50,
    internalNotes: "Original note",
    status: "Confirmed",
    timeInput: "18:30"
  };

  it("changes when editable event details change", () => {
    const draft = createEventDetailsDraft(event as never);
    const base = createEventDetailsDraftSignature(draft);
    const changed = createEventDetailsDraftSignature({
      ...draft,
      internalNotes: "Updated note"
    });

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
