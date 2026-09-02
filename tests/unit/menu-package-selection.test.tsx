import React from "react";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PackageIncludedItems } from "@/features/menu/components/package-included-items";
import { PackageItemPicker } from "@/features/menu/components/package-item-picker";
import { SelectionActionBar } from "@/features/menu/components/selection-action-bar";
import { usePackageSelection } from "@/features/menu/hooks/use-package-selection";
import type { MenuLibraryItem } from "@/features/menu/components/menu-shared";

/**
 * Ticking cards, and the one bar that acts on what is ticked.
 *
 * The panel's two grids share a single selection, so what is asserted is that
 * ticking in one grid gives up the other's, that "select all" reaches only what
 * the search has left on screen, and that the bar counts and names what it is
 * about to do before it does it.
 */

const soupId = "item-soup";
const roastId = "item-roast";
const kugelId = "item-kugel";

function libraryItem(id: string, name: string, category = "Mains"): MenuLibraryItem {
  return {
    id,
    name,
    category,
    usageType: "Catering",
    kind: "Dish",
    services: [],
    kosherType: "Parve",
    containsAlcohol: null,
    allergens: [],
    notes: null,
    pictureUrl: null
  };
}

const items = [
  libraryItem(soupId, "Chicken soup", "Starters"),
  libraryItem(roastId, "Roast beef"),
  libraryItem(kugelId, "Potato kugel")
];

const noop = () => undefined;

function renderPicker(overrides: Partial<React.ComponentProps<typeof PackageItemPicker>> = {}) {
  const props: React.ComponentProps<typeof PackageItemPicker> = {
    availableItems: items,
    libraryItemCount: items.length,
    onReplaceSelection: vi.fn(),
    onToggle: vi.fn(),
    pendingItemIds: new Set(),
    selectedItemIds: new Set(),
    ...overrides
  };

  render(<PackageItemPicker {...props} />);

  return props;
}

describe("package selection", () => {
  it("gives up the other grid's selection when a card is ticked", () => {
    const { result } = renderHook(() => usePackageSelection("package-1"));

    act(() => result.current.toggle("library", soupId));
    act(() => result.current.toggle("included", roastId));

    // Two bars offering opposite verbs is the thing this prevents.
    expect([...result.current.selectedIn("library")]).toEqual([]);
    expect([...result.current.selectedIn("included")]).toEqual([roastId]);
  });

  it("unticks a card that is ticked again", () => {
    const { result } = renderHook(() => usePackageSelection("package-1"));

    act(() => result.current.toggle("library", soupId));
    act(() => result.current.toggle("library", roastId));
    act(() => result.current.toggle("library", soupId));

    expect([...result.current.selectedIn("library")]).toEqual([roastId]);
  });

  it("drops the selection when another package is opened", () => {
    const { result, rerender } = renderHook(
      ({ packageId }: { packageId: string }) => usePackageSelection(packageId),
      { initialProps: { packageId: "package-1" } }
    );

    act(() => result.current.toggle("library", soupId));
    rerender({ packageId: "package-2" });

    // Those ids belong to another package's panel, and in the picker they may
    // not even be on offer.
    expect([...result.current.selectedIn("library")]).toEqual([]);
  });
});

describe("the selection bar", () => {
  function renderBar(
    overrides: Partial<React.ComponentProps<typeof SelectionActionBar>> = {}
  ) {
    const props: React.ComponentProps<typeof SelectionActionBar> = {
      actionLabel: "Add",
      icon: "plus",
      onAct: vi.fn(),
      onClear: vi.fn(),
      selectedCount: 2,
      ...overrides
    };

    render(<SelectionActionBar {...props} />);

    return props;
  }

  it("names the count and the verb before it acts", () => {
    const props = renderBar();

    fireEvent.click(screen.getByRole("button", { name: "Add 2 items" }));

    expect(props.onAct).toHaveBeenCalled();
  });

  it("counts one selected item in the singular", () => {
    renderBar({ selectedCount: 1 });

    expect(
      screen.getByRole("button", { name: "Add 1 item" })
    ).toBeInTheDocument();
  });

  it("says nothing at all until something is ticked", () => {
    renderBar({ selectedCount: 0 });

    // A docked bar reading "0 selected" spends a row of the screen saying
    // nothing.
    expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
  });

  it("takes the removing shape when the included grid holds the selection", () => {
    renderBar({ actionLabel: "Remove", icon: "trash", tone: "danger" });

    expect(
      screen.getByRole("button", { name: "Remove 2 items" })
    ).toBeInTheDocument();
  });

  it("holds the action back while a write is out", () => {
    renderBar({ isBusy: true });

    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  });
});

describe("the library picker", () => {
  it("ticks a card on the click", () => {
    const props = renderPicker();

    fireEvent.click(screen.getByRole("button", { name: "Select Roast beef" }));

    // The click no longer adds anything on its own.
    expect(props.onToggle).toHaveBeenCalledWith(roastId);
  });

  it("selects only what the search has left on screen", () => {
    const props = renderPicker();

    fireEvent.change(screen.getByLabelText("Search library items to add"), {
      target: { value: "roast" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Select all" }));

    // Not the two cards the search just hid.
    expect(props.onReplaceSelection).toHaveBeenCalledWith([roastId]);
  });

  it("turns into Select none once everything showing is ticked", () => {
    const props = renderPicker({
      selectedItemIds: new Set([soupId, roastId, kugelId])
    });

    fireEvent.click(screen.getByRole("button", { name: "Select none" }));

    expect(props.onReplaceSelection).toHaveBeenCalledWith([]);
  });

  it("says nothing can be added when the viewer may not edit", () => {
    renderPicker({ isDisabled: true });

    expect(
      screen.queryByRole("button", { name: "Select all" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Select Roast beef" })
    ).toBeDisabled();
  });
});

describe("the included grid", () => {
  it("no longer removes anything from a menu on the card", () => {
    render(
      <PackageIncludedItems
        includedItems={items}
        onReplaceSelection={noop}
        onToggle={noop}
        pendingItemIds={new Set()}
        selectedItemIds={new Set()}
      />
    );

    // The three-dot menu deleted on the tap that chose it. Removing is now a
    // tick and a counted button, which is the same two taps with a look at what
    // is about to go in between.
    expect(
      screen.queryByRole("button", { name: /More actions/ })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Select Roast beef" })
    ).toBeInTheDocument();
  });

  it("marks a ticked card as pressed", () => {
    render(
      <PackageIncludedItems
        includedItems={items}
        onReplaceSelection={noop}
        onToggle={noop}
        pendingItemIds={new Set()}
        selectedItemIds={new Set([roastId])}
      />
    );

    expect(
      screen.getByRole("button", { name: "Select Roast beef" })
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "Select Potato kugel" })
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("points at the picker when the package is empty", () => {
    render(
      <PackageIncludedItems
        includedItems={[]}
        onReplaceSelection={noop}
        onToggle={noop}
        pendingItemIds={new Set()}
        selectedItemIds={new Set()}
      />
    );

    expect(
      screen.getByText(/No items in this package yet/)
    ).toBeInTheDocument();
  });
});
