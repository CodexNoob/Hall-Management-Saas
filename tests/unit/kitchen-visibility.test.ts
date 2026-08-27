import { describe, expect, it } from "vitest";

import {
  canWriteKitchenLine,
  visibleKitchenLines,
  WHOLE_KITCHEN,
  type KitchenVisibility
} from "@/features/kitchen/server/kitchen-visibility";

/**
 * The rules that make "Kitchen Staff see only their own dishes" true rather than
 * cosmetic.
 *
 * THE NEGATIVE CASES CARRY THE WEIGHT here in the same way they do for the
 * starter matrix: a filter that returns everything passes any test that only
 * checks the caller's own dishes are present.
 */

const COOK: KitchenVisibility = { seesWholeBoard: false, workerId: "worker-1" };
const OTHER_COOK: KitchenVisibility = {
  seesWholeBoard: false,
  workerId: "worker-2"
};
/** Holds `kitchen.read` but is on nobody's roster - a viewer without the key. */
const STRANGER: KitchenVisibility = { seesWholeBoard: false, workerId: null };

const LINES = [
  { id: "a", kind: "Dish" as const, assignedWorkerId: "worker-1" },
  { id: "b", kind: "Dish" as const, assignedWorkerId: "worker-2" },
  { id: "c", kind: "Dish" as const, assignedWorkerId: null },
  { id: "d", kind: "Dish" as const, assignedWorkerId: "worker-1" },
  { id: "addon", kind: "AddOn" as const, assignedWorkerId: null }
];

describe("visibleKitchenLines", () => {
  it("sends the whole sheet to a caller who holds kitchen.read.all", () => {
    expect(visibleKitchenLines(LINES, WHOLE_KITCHEN)).toHaveLength(5);
  });

  it("sends a scoped cook only their own dishes", () => {
    expect(visibleKitchenLines(LINES, COOK).map((line) => line.id)).toEqual([
      "a",
      "d",
      "addon"
    ]);
  });

  it("withholds another cook's dishes", () => {
    const ids = visibleKitchenLines(LINES, COOK).map((line) => line.id);

    expect(ids).not.toContain("b");
  });

  it("withholds unassigned dishes, which belong to nobody", () => {
    const ids = visibleKitchenLines(LINES, COOK).map((line) => line.id);

    expect(ids).not.toContain("c");
  });

  it("shows add-ons to a rostered cook even though they cannot be assigned", () => {
    const ids = visibleKitchenLines(LINES, COOK).map((line) => line.id);

    expect(ids).toContain("addon");
  });

  it("sends nothing to a scoped caller who is on no roster", () => {
    // Fails closed. The alternative - treating "no worker row" as "no filter" -
    // is how a restriction becomes a no-op for exactly the accounts nobody
    // remembered to add.
    expect(visibleKitchenLines(LINES, STRANGER)).toEqual([]);
  });

  it("gives each cook a different sheet from the same lines", () => {
    expect(visibleKitchenLines(LINES, COOK).map((line) => line.id)).toEqual([
      "a",
      "d",
      "addon"
    ]);
    expect(
      visibleKitchenLines(LINES, OTHER_COOK).map((line) => line.id)
    ).toEqual(["b", "addon"]);
  });

  it("copies rather than aliases, so a caller cannot mutate the source", () => {
    const visible = visibleKitchenLines(LINES, WHOLE_KITCHEN);
    visible.pop();

    expect(LINES).toHaveLength(5);
  });
});

describe("canWriteKitchenLine", () => {
  it("lets an unscoped caller write any line", () => {
    expect(canWriteKitchenLine("worker-2", WHOLE_KITCHEN)).toBe(true);
    expect(canWriteKitchenLine(null, WHOLE_KITCHEN)).toBe(true);
  });

  it("lets a cook write their own dish", () => {
    expect(canWriteKitchenLine("worker-1", COOK)).toBe(true);
  });

  it("refuses a cook another cook's dish", () => {
    // The whole point of the write check: ids travel in the request body, so
    // read scoping alone would leave this reachable by guessing.
    expect(canWriteKitchenLine("worker-2", COOK)).toBe(false);
  });

  it("refuses a cook an unassigned dish", () => {
    // Claiming unassigned work is `kitchen.worker.assign`, which a cook does not
    // hold. Marking it done would be claiming it by the back door.
    expect(canWriteKitchenLine(null, COOK)).toBe(false);
    expect(canWriteKitchenLine(undefined, COOK)).toBe(false);
  });

  it("refuses a scoped caller who is on no roster", () => {
    expect(canWriteKitchenLine("worker-1", STRANGER)).toBe(false);
    expect(canWriteKitchenLine(null, STRANGER)).toBe(false);
  });
});
