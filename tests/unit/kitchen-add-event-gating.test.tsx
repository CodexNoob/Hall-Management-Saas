import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlusButton } from "@/features/kitchen/components/kitchen-plus-button";
import { KitchenToolbar } from "@/features/kitchen/components/kitchen-toolbar";
import { AddKitchenEventDialog } from "@/features/kitchen/forms/add-kitchen-event-dialog";

describe("PlusButton", () => {
  it("is disabled when disabled is true", () => {
    render(
      <PlusButton disabled label="Add kitchen event on Jan 1" onClick={vi.fn()} />
    );
    expect(
      screen.getByRole("button", { name: "Add kitchen event on Jan 1" })
    ).toBeDisabled();
  });

  it("is enabled when disabled is not set", () => {
    render(<PlusButton label="Add kitchen event on Jan 1" onClick={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: "Add kitchen event on Jan 1" })
    ).not.toBeDisabled();
  });
});

describe("KitchenToolbar", () => {
  it("disables + Add Kitchen Event when canAddKitchenEvent is false", () => {
    render(
      <KitchenToolbar
        canAddKitchenEvent={false}
        onAddKitchenEvent={vi.fn()}
        onWorkersOnlyChange={vi.fn()}
        workersOnly={false}
      />
    );
    expect(
      screen.getByRole("button", { name: "+ Add Kitchen Event" })
    ).toBeDisabled();
  });

  it("enables + Add Kitchen Event when canAddKitchenEvent is true", () => {
    render(
      <KitchenToolbar
        canAddKitchenEvent
        onAddKitchenEvent={vi.fn()}
        onWorkersOnlyChange={vi.fn()}
        workersOnly={false}
      />
    );
    expect(
      screen.getByRole("button", { name: "+ Add Kitchen Event" })
    ).not.toBeDisabled();
  });
});

describe("AddKitchenEventDialog", () => {
  it("disables Save Event and explains why when canSave is false", () => {
    render(
      <AddKitchenEventDialog
        canSave={false}
        date="Jan 1"
        onClose={vi.fn()}
        onSave={vi.fn()}
        open
      />
    );

    expect(screen.getByRole("button", { name: "Save Event" })).toBeDisabled();
    expect(
      screen.getByText(/do not have permission to add kitchen events/i)
    ).toBeInTheDocument();
  });

  it("never calls onSave when the form is submitted directly without permission", () => {
    const onSave = vi.fn();
    render(
      <AddKitchenEventDialog
        canSave={false}
        date="Jan 1"
        onClose={vi.fn()}
        onSave={onSave}
        open
      />
    );

    fireEvent.change(screen.getByLabelText("Event name"), {
      target: { value: "Staff Lunch" }
    });
    fireEvent.change(screen.getByLabelText("Portions"), {
      target: { value: "40" }
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Save Event" }).closest("form")!
    );

    expect(onSave).not.toHaveBeenCalled();
  });

  it("calls onSave with the form values when canSave is true", () => {
    const onSave = vi.fn();
    render(
      <AddKitchenEventDialog
        canSave
        date="Jan 1"
        onClose={vi.fn()}
        onSave={onSave}
        open
      />
    );

    expect(
      screen.getByRole("button", { name: "Save Event" })
    ).not.toBeDisabled();

    fireEvent.change(screen.getByLabelText("Event name"), {
      target: { value: "Staff Lunch" }
    });
    fireEvent.change(screen.getByLabelText("Portions"), {
      target: { value: "40" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Event" }));

    expect(onSave).toHaveBeenCalledWith({
      eventName: "Staff Lunch",
      portions: "40",
      kitchenNote: ""
    });
  });
});
