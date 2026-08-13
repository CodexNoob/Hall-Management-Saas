import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HallMapObjectInspector } from "@/features/hall-room-map/components/hall-map-object-inspector";

const selectedObject = {
  id: "object-1",
  type: "round-table" as const,
  name: "Table 1",
  x: 100,
  y: 120,
  width: 80,
  height: 80,
  rotation: 0,
  seats: 10,
  seatingUse: "adult" as const
};

describe("HallMapObjectInspector numeric fields", () => {
  const onUpdateSelectedObject = vi.fn();

  beforeEach(() => vi.clearAllMocks());

  function renderInspector() {
    return render(
      <HallMapObjectInspector
        onUpdateSelectedObject={onUpdateSelectedObject}
        selectedObject={selectedObject}
      />
    );
  }

  it("never writes 0 when the width is cleared", () => {
    // The reported defect: these were type="number" feeding
    // `Number(event.target.value)`, and `Number("")` is 0 - so clearing the box
    // silently collapsed the shape instead of reporting anything.
    renderInspector();

    fireEvent.change(screen.getByLabelText("Width"), { target: { value: "" } });

    expect(onUpdateSelectedObject).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a number.");
  });

  it("reports typed text that is not a number instead of swallowing it", () => {
    renderInspector();

    fireEvent.change(screen.getByLabelText("Width"), {
      target: { value: "abc" }
    });

    expect(onUpdateSelectedObject).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a number.");
  });

  it("refuses a width below the bound the server enforces", () => {
    renderInspector();

    fireEvent.change(screen.getByLabelText("Width"), { target: { value: "5" } });

    expect(onUpdateSelectedObject).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Width must be at least 10."
    );
  });

  it("refuses a rotation past 360 degrees", () => {
    renderInspector();

    fireEvent.change(screen.getByLabelText("Rotation"), {
      target: { value: "400" }
    });

    expect(onUpdateSelectedObject).not.toHaveBeenCalled();
  });

  it("refuses a fractional seat count", () => {
    renderInspector();

    fireEvent.change(screen.getByLabelText("Seats"), {
      target: { value: "10.5" }
    });

    expect(onUpdateSelectedObject).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Seats must be a whole number."
    );
  });

  it("commits a valid value and clears the error", () => {
    renderInspector();

    const width = screen.getByLabelText("Width");

    fireEvent.change(width, { target: { value: "" } });
    expect(screen.getByRole("alert")).toBeInTheDocument();

    fireEvent.change(width, { target: { value: "120" } });

    expect(onUpdateSelectedObject).toHaveBeenCalledWith({ width: 120 });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("rolls back a half-typed value instead of leaving the prefix committed", () => {
    // Committing per keystroke means a prefix of an out-of-range number is
    // itself in range: typing "400" into a 0-360 field commits 4, then 40, then
    // stops. Without a rollback the shape would be left rotated 40 degrees by
    // an entry the field had already rejected.
    renderInspector();

    const rotation = screen.getByLabelText("Rotation");

    fireEvent.change(rotation, { target: { value: "4" } });
    fireEvent.change(rotation, { target: { value: "40" } });
    fireEvent.change(rotation, { target: { value: "400" } });

    expect(onUpdateSelectedObject).toHaveBeenLastCalledWith({ rotation: 40 });

    fireEvent.blur(rotation);

    expect(onUpdateSelectedObject).toHaveBeenLastCalledWith({ rotation: 0 });
    expect(rotation).toHaveValue("0");
  });

  it("keeps a committed value when the edit ends on something valid", () => {
    renderInspector();

    const rotation = screen.getByLabelText("Rotation");

    fireEvent.change(rotation, { target: { value: "9" } });
    fireEvent.change(rotation, { target: { value: "90" } });
    fireEvent.blur(rotation);

    // Nothing to undo, so the last commit must stand.
    expect(onUpdateSelectedObject).toHaveBeenLastCalledWith({ rotation: 90 });
  });

  it("keeps the raw text visible while it is being typed", () => {
    renderInspector();

    const seats = screen.getByLabelText("Seats");
    fireEvent.change(seats, { target: { value: "1x" } });

    // A type="number" input would have thrown this away and shown "".
    expect(seats).toHaveValue("1x");
  });
});
