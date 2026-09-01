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
  styles: string[] = ["Buffet"],
  itemKind = "Food"
): MenuSelectorItem {
  return {
    id,
    name,
    kind: "Dish",
    itemKind,
    styles,
    price: null,
    pictureUrl: null
  };
}

/** A drink carries the same styles a dish does; only its kind differs. */
function drink(
  id: string,
  name: string,
  styles: string[] = ["Buffet"]
): MenuSelectorItem {
  return dish(id, name, styles, "Drink");
}

function addOn(id: string, name: string, price: number): MenuSelectorItem {
  return {
    id,
    name,
    kind: "AddOn",
    itemKind: null,
    styles: [],
    price,
    pictureUrl: null
  };
}

const items = [
  dish("d1", "Braised ribs", ["Buffet", "Plated"]),
  dish("d2", "Potato kugel", ["Buffet"]),
  dish("d3", "Chicken soup", ["Plated"]),
  // Catalogued but never given a rule. Offered everywhere rather than hidden
  // everywhere, which is what it used to be.
  dish("d4", "Grilled salmon", []),
  // A drink with a Buffet rule. It has to be counted like anything else, so it
  // carries a style - and it must still stay out of the Buffet list.
  drink("k1", "Grape juice", ["Buffet"]),
  drink("k2", "Sparkling water", ["Plated"]),
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
    // Buffet-only, so it has no business on the plated tab. A dish that has
    // been given an answer is filtered by it; only a dish with no answer at all
    // is offered on both.
    expect(screen.queryByRole("button", { name: /Potato kugel/ })).toBeNull();
  });

  it("keeps drinks out of the style tabs and lists them under Drinks", () => {
    renderDrawer();

    // A drink is counted like anything else, so it carries a Buffet rule. That
    // rule is why it used to appear here, and why the section is filed on kind
    // instead: the style says how it is served, not what it is.
    expect(screen.queryByRole("button", { name: /Grape juice/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Plated" }));
    expect(
      screen.queryByRole("button", { name: /Sparkling water/ })
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Drinks" }));
    // Both, whichever style each one is served in.
    expect(
      screen.getByRole("button", { name: /Grape juice/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Sparkling water/ })
    ).toBeInTheDocument();
    // And no food, however it is served.
    expect(screen.queryByRole("button", { name: /Potato kugel/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Grilled salmon/ })).toBeNull();
  });

  it("offers a dish with no rule at all under every style", () => {
    renderDrawer();

    // The dead end this closes: with no rule the dish matched neither tab, so
    // it sat in the library unreachable by any event.
    expect(
      screen.getByRole("button", { name: /Grilled salmon/ })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Plated" }));

    expect(
      screen.getByRole("button", { name: /Grilled salmon/ })
    ).toBeInTheDocument();
  });

  it("says a ruleless dish needs a rule before it is picked", () => {
    renderDrawer();

    // Named on the card rather than discovered after the add: clicking this one
    // puts a question on the menu, not just a dish.
    expect(
      screen.getByRole("button", { name: /Grilled salmon/ })
    ).toHaveTextContent("Needs a counting rule");
    // A dish that does carry a rule still reads as the tab it is being pinned
    // to, unchanged.
    expect(
      screen.getByRole("button", { name: /Potato kugel/ })
    ).toHaveTextContent("Buffet");
  });

  it("adds a ruleless dish under the tab it was picked on", () => {
    const { onAdd } = renderDrawer({ initialSection: "Plated" });

    fireEvent.click(screen.getByRole("button", { name: /Grilled salmon/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add 1 item" }));

    // The style is decided by the click even though the dish has no rule for
    // it - that is what the band on the menu tab then asks about.
    expect(queued(onAdd)).toEqual(["Grilled salmon:Plated"]);
  });

  it("clears the section it is showing, not another one", () => {
    const { onClear } = renderDrawer({ initialSection: "Plated" });

    fireEvent.click(screen.getByRole("button", { name: "Clear plated" }));

    expect(onClear).toHaveBeenCalledWith("Plated");
  });

  it("keeps a half-made selection when the parent re-renders", () => {
    const props = {
      initialSection: "Buffet" as const,
      items,
      onAdd: vi.fn(),
      onClear: vi.fn(),
      onClose: vi.fn(),
      open: true,
      selectedIds: new Set<string>()
    };
    const { rerender } = render(<MenuItemSelectorDrawer {...props} />);

    fireEvent.click(screen.getByRole("button", { name: /Potato kugel/ }));
    fireEvent.click(screen.getByRole("button", { name: "Plated" }));

    // The parent rebuilds its handlers every render, so a re-render it does for
    // its own reasons - a save settling, an undo offer timing out after a
    // removal - hands the drawer a brand new `onClose`. That used to read as
    // the drawer having just been opened: the pick vanished and the tab snapped
    // back, seconds after a removal and never again once things had settled.
    rerender(<MenuItemSelectorDrawer {...props} onClose={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Plated" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    fireEvent.click(screen.getByRole("button", { name: "Add 1 item" }));

    expect(queued(props.onAdd)).toEqual(["Potato kugel:Buffet"]);
  });
});
