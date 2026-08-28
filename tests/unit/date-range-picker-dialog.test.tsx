import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  DateRangePickerDialog,
  type DateRange
} from "@/features/calendar/forms/date-range-picker-dialog";

/**
 * What the range picker does once a range is complete.
 *
 * Picking the end date already applied the range, but the calendar stayed open
 * over the filtered list, so the result of the pick was hidden behind the thing
 * that made it. There is nothing left to choose at that point, so the picker
 * dismisses itself.
 */

const startDate = new Date(2026, 7, 5);
const endDate = new Date(2026, 7, 18);

function labelFor(date: Date) {
  return `Select ${new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date)}`;
}

/** Mirrors how both tabs drive the picker: the parent owns `isOpen`. */
function PickerHost({ onApply }: { onApply: (range: DateRange) => void }) {
  const [isOpen, setIsOpen] = useState(true);
  const [range, setRange] = useState<DateRange>({ startDate, endDate });

  return (
    <DateRangePickerDialog
      endDate={range.endDate}
      isOpen={isOpen}
      onApply={(nextRange) => {
        setRange(nextRange);
        onApply(nextRange);
      }}
      onClose={() => setIsOpen(false)}
      startDate={range.startDate}
    />
  );
}

describe("DateRangePickerDialog", () => {
  it("stays open after the start date, since the range is not complete", () => {
    const onApply = vi.fn();
    render(<PickerHost onApply={onApply} />);

    fireEvent.click(
      screen.getByLabelText(labelFor(new Date(2026, 7, 10)))
    );

    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Select the end date.")).toBeTruthy();
  });

  it("applies the range and closes itself on the end date", () => {
    const onApply = vi.fn();
    render(<PickerHost onApply={onApply} />);

    fireEvent.click(screen.getByLabelText(labelFor(new Date(2026, 7, 10))));
    fireEvent.click(screen.getByLabelText(labelFor(new Date(2026, 7, 14))));

    expect(onApply).toHaveBeenCalledTimes(1);
    const applied = onApply.mock.calls[0]?.[0] as DateRange;
    expect(applied.startDate.getDate()).toBe(10);
    expect(applied.endDate.getDate()).toBe(14);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("restarts the range rather than closing when the second pick precedes the first", () => {
    const onApply = vi.fn();
    render(<PickerHost onApply={onApply} />);

    fireEvent.click(screen.getByLabelText(labelFor(new Date(2026, 7, 14))));
    fireEvent.click(screen.getByLabelText(labelFor(new Date(2026, 7, 10))));

    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Select the end date.")).toBeTruthy();
  });
});
