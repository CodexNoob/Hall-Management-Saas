import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlusButton } from "@/features/kitchen/components/kitchen-plus-button";
import { KitchenToolbar } from "@/features/kitchen/components/kitchen-toolbar";
import { AddKitchenEventDialog } from "@/features/kitchen/forms/add-kitchen-event-dialog";

// A kitchen event is raised against a menu, so every render needs something
// to pick.
const menuOptions = [
  { id: "menu-1", name: "Shabbos Lunch", dishCount: 4 },
  { id: "menu-2", name: "Staff Meal", dishCount: 2 }
];

describe("PlusButton", () => {
  it("is disabled when disabled is true", () => {
    render(
      <PlusButton
        disabled
        label="Add kitchen event on Jan 1"
        onClick={vi.fn()}
      />
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
        canManageWorkers
        onAddKitchenEvent={vi.fn()}
        onManageWorkers={vi.fn()}
        onWorkersOnlyChange={vi.fn()}
        workersOnly={false}
      />
    );
    expect(
      screen.getByRole("button", { name: /add kitchen event/i })
    ).toBeDisabled();
  });

  it("enables + Add Kitchen Event when canAddKitchenEvent is true", () => {
    render(
      <KitchenToolbar
        canAddKitchenEvent
        canManageWorkers
        onAddKitchenEvent={vi.fn()}
        onManageWorkers={vi.fn()}
        onWorkersOnlyChange={vi.fn()}
        workersOnly={false}
      />
    );
    expect(
      screen.getByRole("button", { name: /add kitchen event/i })
    ).not.toBeDisabled();
  });
});

describe("AddKitchenEventDialog", () => {
  it("disables Save Event and explains why when canSave is false", () => {
    render(
      <AddKitchenEventDialog
        canSave={false}
        date="Jan 1"
        menus={menuOptions}
        onClose={vi.fn()}
        onSave={vi.fn()}
        open
      />
    );

    expect(screen.getByRole("button", { name: "Save event" })).toBeDisabled();
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
        menus={menuOptions}
        onClose={vi.fn()}
        onSave={onSave}
        open
      />
    );

    fireEvent.change(screen.getByLabelText("Menu"), {
      target: { value: "menu-1" }
    });
    fireEvent.change(screen.getByLabelText("Portions"), {
      target: { value: "40" }
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Save event" }).closest("form")!
    );

    expect(onSave).not.toHaveBeenCalled();
  });

  it("calls onSave with the form values when canSave is true", () => {
    const onSave = vi.fn();
    render(
      <AddKitchenEventDialog
        canSave
        date="Jan 1"
        menus={menuOptions}
        onClose={vi.fn()}
        onSave={onSave}
        open
      />
    );

    expect(
      screen.getByRole("button", { name: "Save event" })
    ).not.toBeDisabled();

    fireEvent.change(screen.getByLabelText("Menu"), {
      target: { value: "menu-1" }
    });
    fireEvent.change(screen.getByLabelText("Portions"), {
      target: { value: "40" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save event" }));

    // The whole payload, not a subset: the new-menu fields ride along empty
    // when an existing menu is picked, and the caller decides which of the two
    // shapes to send by looking at them.
    expect(onSave).toHaveBeenCalledWith({
      menuId: "menu-1",
      menuName: "Shabbos Lunch",
      portions: "40",
      kitchenNote: "",
      quickMenuName: "",
      quickMenuDishes: "",
      saveQuickMenuToLibrary: false
    });
  });

  it("asks only for a menu and a headcount, not booking details", () => {
    render(
      <AddKitchenEventDialog
        canSave
        date="Jan 1"
        menus={menuOptions}
        onClose={vi.fn()}
        onSave={vi.fn()}
        open
      />
    );

    // A kitchen event is production with no booking behind it, so none of the
    // fields the New Booking form insists on belong here.
    expect(screen.getByLabelText("Menu")).toBeInTheDocument();
    expect(screen.getByLabelText("Portions")).toBeInTheDocument();
    for (const absent of [/client/i, /phone/i, /hall/i, /event type/i]) {
      expect(screen.queryByLabelText(absent)).toBeNull();
    }
  });

  it("will not save without a menu, because the kitchen would not know what to cook", () => {
    const onSave = vi.fn();
    render(
      <AddKitchenEventDialog
        canSave
        date="Jan 1"
        menus={menuOptions}
        onClose={vi.fn()}
        onSave={onSave}
        open
      />
    );

    fireEvent.change(screen.getByLabelText("Portions"), {
      target: { value: "40" }
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Save event" }).closest("form")!
    );

    expect(onSave).not.toHaveBeenCalled();
  });

  describe("portions validation", () => {
    function renderDialog(onSave = vi.fn()) {
      render(
        <AddKitchenEventDialog
          canSave
          date="Jan 1"
        menus={menuOptions}
          onClose={vi.fn()}
          onSave={onSave}
          open
        />
      );

      fireEvent.change(screen.getByLabelText("Menu"), {
      target: { value: "menu-1" }
    });

      return onSave;
    }

    function submitWith(portions: string) {
      fireEvent.change(screen.getByLabelText("Portions"), {
        target: { value: portions }
      });
      fireEvent.click(screen.getByRole("button", { name: "Save event" }));
    }

    // The kitchen board renders this value straight back as "<portions>
    // portions", so anything that is not a number ends up on the wall as
    // "abc portions". The old guard was a truthiness check, which let it past.
    const rejected = [
      { portions: "abc", expected: "Enter a number." },
      // Exponent notation is rejected on purpose - see parseNumericInput.
      { portions: "1e5", expected: "Enter a number." },
      { portions: "0", expected: "Portions must be at least 1." },
      { portions: "-40", expected: "Portions must be at least 1." },
      { portions: "2.5", expected: "Portions must be a whole number." }
    ];

    for (const { portions, expected } of rejected) {
      it(`refuses "${portions}" and says why`, () => {
        const onSave = renderDialog();

        submitWith(portions);

        expect(onSave).not.toHaveBeenCalled();
        expect(screen.getByRole("alert")).toHaveTextContent(expected);
      });
    }

    it("describes the input with its error for screen readers", () => {
      renderDialog();

      submitWith("abc");

      const input = screen.getByLabelText("Portions");
      expect(input).toHaveAttribute("aria-invalid", "true");
      expect(input).toHaveAttribute(
        "aria-describedby",
        screen.getByRole("alert").id
      );
    });

    it("clears the error once the count is corrected", () => {
      const onSave = renderDialog();

      submitWith("abc");
      expect(screen.getByRole("alert")).toBeInTheDocument();

      submitWith("40");

      expect(screen.queryByRole("alert")).toBeNull();
      expect(onSave).toHaveBeenCalledWith({
        menuId: "menu-1",
        menuName: "Shabbos Lunch",
        portions: "40",
        kitchenNote: "",
        quickMenuName: "",
        quickMenuDishes: "",
        saveQuickMenuToLibrary: false
      });
    });
  });
});
