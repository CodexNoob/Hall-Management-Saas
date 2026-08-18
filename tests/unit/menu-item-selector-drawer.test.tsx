import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MenuItemSelectorDrawer,
  type MenuSelection,
  type MenuSelectorItem
} from "@/features/events/components/menu-item-selector-drawer";

function dish(
  id: string,
  name: string,
  styles: string[] = ["Buffet"]
): MenuSelectorItem {
  return { id, name, kind: "Dish", styles, price: null, pictureUrl: null };
}

function addOn(id: string, name: string, price: number): MenuSelectorItem {
  return { id, name, kind: "AddOn", styles: [], price, pictureUrl: null };
}

const items = [
  dish("d1", "Braised ribs", ["Buffet", "Plated"]),
  dish("d2", "Potato kugel", ["Buffet"]),
  dish("d3", "Chicken soup", ["Plated"]),
  addOn("a1", "Viennese table", 850)
];

function renderDrawer(overrides: Partial<React.ComponentProps<typeof MenuItemSelectorDrawer>> = {}) {
  const onAdd = vi.fn();
  const onClear = vi.fn();
  const onClose = vi.fn();

  render(
    <MenuItemSelectorDrawer
      initialSection="Buffet"
      items={items}
      onAdd={onAdd}
      onClear={onClear}
      onClose={onClose}
      open
      selectedIds={new Set()}
      {...overrides}
    />
  );

  return { onAdd, onClear, onClose };
}

/** The queued items, flattened to `name:section` for readable assertions. */
function queued(onAdd: ReturnType<typeof vi.fn>) {
  const selections = onAdd.mock.calls[0][0] as MenuSelection[];
  return selections.map((s) => `${s.item.name}:${s.section}`);
}

describe("MenuItemSelectorDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adds nothing until the batch is committed", () => {
    const { onAdd } = renderDrawer();

    fireEvent.click(screen.getByRole("button", { name: /Braised ribs/ }));
    fireEvent.click(screen.getByRole("button", { name: /Potato kugel/ }));

    // Picking is not adding - that is the whole point of batching.
    expect(onAdd).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Add 2 items" }));

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(queued(onAdd)).toEqual([
      "Braised ribs:Buffet",
      "Potato kugel:Buffet"
    ]);
  });

  it("keeps the add button disabled while nothing is picked", () => {
    renderDrawer();

    expect(screen.getByRole("button", { name: "Add selected" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /Potato kugel/ }));

    expect(screen.getByRole("button", { name: "Add 1 item" })).not.toBeDisabled();
  });

  it("unpicks an item clicked twice in the same section", () => {
    const { onAdd } = renderDrawer();

    fireEvent.click(screen.getByRole("button", { name: /Potato kugel/ }));
    fireEvent.click(screen.getByRole("button", { name: /Potato kugel/ }));

    expect(screen.getByRole("button", { name: "Add selected" })).toBeDisabled();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("carries a selection across section tabs and adds them together", () => {
    const { onAdd } = renderDrawer();

    fireEvent.click(screen.getByRole("button", { name: /Potato kugel/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add-ons" }));
    fireEvent.click(screen.getByRole("button", { name: /Viennese table/ }));

    // The buffet pick survived the tab switch rather than being dropped.
    fireEvent.click(screen.getByRole("button", { name: "Add 2 items" }));

    expect(queued(onAdd)).toEqual([
      "Potato kugel:Buffet",
      "Viennese table:AddOn"
    ]);
  });

  it("moves a dish to the section it was last picked under", () => {
    const { onAdd } = renderDrawer();

    // Braised ribs is served both ways, so it appears on both tabs.
    fireEvent.click(screen.getByRole("button", { name: /Braised ribs/ }));
    fireEvent.click(screen.getByRole("button", { name: "Plated" }));
    fireEvent.click(screen.getByRole("button", { name: /Braised ribs/ }));

    fireEvent.click(screen.getByRole("button", { name: "Add 1 item" }));

    // One line, plated - not two lines, and not still buffet.
    expect(queued(onAdd)).toEqual(["Braised ribs:Plated"]);
  });

  it("will not let an item already on the menu be picked", () => {
    renderDrawer({ selectedIds: new Set(["d2"]) });

    expect(screen.getByRole("button", { name: /Potato kugel/ })).toBeDisabled();
    expect(screen.getByText("Already on this menu")).toBeInTheDocument();
  });

  it("only offers dishes that carry a rule for the active style", () => {
    renderDrawer({ initialSection: "Plated" });

    expect(screen.getByRole("button", { name: /Braised ribs/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Chicken soup/ })).toBeInTheDocument();
    // Buffet-only, so it has no business on the plated tab.
    expect(screen.queryByRole("button", { name: /Potato kugel/ })).toBeNull();
  });

  it("clears the section it is showing, not another one", () => {
    const { onClear } = renderDrawer({ initialSection: "Plated" });

    fireEvent.click(screen.getByRole("button", { name: "Clear plated" }));

    expect(onClear).toHaveBeenCalledWith("Plated");
  });
});
