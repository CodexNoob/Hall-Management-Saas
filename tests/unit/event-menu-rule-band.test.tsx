import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/menu/services/menu-items", () => ({
  updateMenuItem: vi.fn()
}));

import {
  EventMenuRuleBand,
  rulelessLines
} from "@/features/events/components/event-menu-rule-band";
import { updateMenuItem } from "@/features/menu/services/menu-items";
import type {
  EventMenuLine,
  EventMenuResponse
} from "@/features/events/components/event-manager-shared";
import { cacheTestSession, starterPermissionsExcept } from "./auth-session-fixture";

/**
 * Answering "how much of this do we cook" on the event that first needed it.
 *
 * The band exists because a dish may be catalogued without a counting rule, and
 * until now that dish could not reach an event at all. What matters here is not
 * that the form renders - it is where the answer GOES: to the library, merged
 * with the rules the dish already carries, so that filling in a buffet rate
 * cannot quietly destroy the plated one.
 */

const itemId = "item-salmon";

function line(overrides: Partial<EventMenuLine> = {}): EventMenuLine {
  return {
    id: "line-1",
    menuItemId: itemId,
    addOnId: null,
    kind: "Dish",
    name: "Grilled salmon",
    pictureUrl: null,
    serviceStyle: "Buffet",
    // Served buffet at this event, but the only rule it carries is plated.
    availableStyles: ["Plated"],
    price: null,
    notes: null,
    sortOrder: 0,
    quantityMultiplier: 1,
    source: "Manual",
    isRetired: false,
    ...overrides
  };
}

const platedRule = {
  serviceStyle: "Plated",
  quantity: 1,
  unit: "plate",
  per: 1,
  perBasis: "TotalGuests",
  rounding: "Exact",
  minimumUnits: null
};

function catalogItem(
  overrides: Partial<EventMenuResponse["items"][number]> = {}
): EventMenuResponse["items"][number] {
  return {
    id: itemId,
    name: "Grilled salmon",
    isActive: true,
    kind: "Food",
    services: [platedRule],
    pictureUrl: null,
    ...overrides
  };
}

function renderBand(
  overrides: Partial<React.ComponentProps<typeof EventMenuRuleBand>> = {}
) {
  const onSaved = vi.fn(async () => undefined);

  render(
    <EventMenuRuleBand
      catalog={[catalogItem()]}
      disabled={false}
      lines={[line()]}
      onSaved={onSaved}
      {...overrides}
    />
  );

  return { onSaved };
}

/** The `services` array the band sent, keyed by style for readable assertions. */
function savedRules() {
  const [, changes] = vi.mocked(updateMenuItem).mock.calls[0];

  return Object.fromEntries(
    (changes.services ?? []).map((rule) => [rule.serviceStyle, rule])
  );
}

describe("rulelessLines", () => {
  it("picks the dishes whose style carries no rule", () => {
    expect(rulelessLines([line()]).map((entry) => entry.id)).toEqual(["line-1"]);
  });

  it("leaves a dish that has a rule for the style it is served in", () => {
    expect(
      rulelessLines([line({ availableStyles: ["Buffet", "Plated"] })])
    ).toEqual([]);
  });

  it("leaves a dish that has not been told which style applies", () => {
    // That one is the OTHER band's question. Asking for a rate before knowing
    // which service it is a rate for would be asking about nothing.
    expect(
      rulelessLines([line({ serviceStyle: null, availableStyles: [] })])
    ).toEqual([]);
  });

  it("leaves add-ons alone, which are not cooked to a rule", () => {
    expect(
      rulelessLines([
        line({ kind: "AddOn", menuItemId: null, addOnId: "addon-1" })
      ])
    ).toEqual([]);
  });
});

describe("EventMenuRuleBand", () => {
  beforeEach(() => {
    window.localStorage.clear();
    cacheTestSession(["menu.update"]);
    vi.mocked(updateMenuItem).mockReset();
    vi.mocked(updateMenuItem).mockResolvedValue(undefined);
  });

  it("renders nothing when every dish has its rule", () => {
    const { container } = render(
      <EventMenuRuleBand
        catalog={[catalogItem()]}
        disabled={false}
        lines={[]}
        onSaved={vi.fn(async () => undefined)}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("opens on the defaults for the dish's kind", () => {
    renderBand();

    expect(screen.getByLabelText("Buffet quantity")).toHaveValue("1");
    expect(screen.getByLabelText("Buffet unit")).toHaveValue("tray");
    expect(screen.getByLabelText("Buffet per quantity")).toHaveValue("30");
  });

  it("opens a drink on bottles per table, under the word it is served by", () => {
    renderBand({
      catalog: [catalogItem({ kind: "Drink" })],
      lines: [line({ serviceStyle: "Plated", availableStyles: ["Buffet"] })]
    });

    // A drink is not plated, it is put on the table - and the numbers move with
    // the word.
    expect(screen.getByLabelText("Table unit")).toHaveValue("bottle");
    expect(screen.getByLabelText("Table per basis")).toHaveValue("Tables");
  });

  it("saves the typed rule to the library and keeps the one already there", async () => {
    const { onSaved } = renderBand();

    fireEvent.change(screen.getByLabelText("Buffet per quantity"), {
      target: { value: "25" }
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save rule" }));
    });

    expect(updateMenuItem).toHaveBeenCalledTimes(1);
    expect(vi.mocked(updateMenuItem).mock.calls[0][0]).toBe(itemId);

    const rules = savedRules();

    expect(rules.Buffet).toMatchObject({
      quantity: 1,
      unit: "tray",
      per: 25,
      perBasis: "TotalGuests",
      rounding: "Up",
      minimumUnits: null
    });
    // The whole reason the existing rules are read back first: `services`
    // replaces the stored set, so sending only the new rule would delete this.
    expect(rules.Plated).toMatchObject({ unit: "plate", rounding: "Exact" });

    // The band cannot clear itself - `availableStyles` is computed server side,
    // so the menu has to be re-read before the line leaves.
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it("reports a refused rule instead of sending a silent zero", async () => {
    renderBand();

    fireEvent.change(screen.getByLabelText("Buffet quantity"), {
      target: { value: "0" }
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save rule" }));
    });

    expect(updateMenuItem).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Quantity must be greater than zero."
    );
  });

  it("refuses rather than dropping a stored rule it cannot parse", async () => {
    // `readServiceRules` degrades to "no rule" on an unreadable row, which is
    // right while rendering and destructive on a write - the parsed set is what
    // gets sent back, so degrading would delete what it failed to read.
    const { onSaved } = renderBand({
      catalog: [
        catalogItem({
          services: [
            platedRule,
            { ...platedRule, serviceStyle: "Smorgasbord" }
          ]
        })
      ]
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save rule" }));
    });

    expect(updateMenuItem).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Grilled salmon has a counting rule this page cannot read."
    );
  });

  it("surfaces a server refusal rather than pretending it saved", async () => {
    vi.mocked(updateMenuItem).mockRejectedValue(
      new Error("This item is on a confirmed menu.")
    );

    const { onSaved } = renderBand();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save rule" }));
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "This item is on a confirmed menu."
    );
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("explains rather than offering a form without canEditMenu", () => {
    // Writing a rule is a library edit. Every stock role holds both permissions
    // or neither, but a hand-tuned grant would otherwise get a 403 from a form
    // that looked writable.
    cacheTestSession(starterPermissionsExcept("event-manager", ["menu.update"], []));
    renderBand();

    expect(screen.getByText("Grilled salmon")).toBeInTheDocument();
    expect(screen.queryByLabelText("Buffet quantity")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save rule" })).toBeNull();
  });

  it("does not offer a save while the menu is confirmed", () => {
    renderBand({ disabled: true });

    expect(screen.getByRole("button", { name: "Save rule" })).toBeDisabled();
    expect(screen.getByLabelText("Buffet quantity")).toBeDisabled();
  });
});
