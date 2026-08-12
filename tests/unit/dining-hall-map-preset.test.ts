import { describe, expect, it } from "vitest";

import { buildDiningTablesFromHallMapPresetObjects } from "@/features/dining/components/dining-shared";

describe("dining hall map preset conversion", () => {
  it("converts valid hall map objects into positioned dining tables", () => {
    let nextId = 0;

    const tables = buildDiningTablesFromHallMapPresetObjects(
      [
        {
          id: "adult-a",
          type: "round-table",
          name: "Adult A",
          x: 10,
          y: 20,
          width: 80,
          height: 80,
          rotation: 5,
          seats: 10,
          seatingUse: "adult"
        },
        {
          id: "adult-b",
          type: "round-table",
          name: "Adult B",
          x: 100,
          y: 120,
          width: 80,
          height: 80,
          rotation: 0,
          seats: 10,
          seatingUse: "adult"
        },
        {
          id: "kids",
          type: "kids-table",
          name: "Kids",
          x: 200,
          y: 220,
          width: 72,
          height: 72,
          rotation: 15,
          seats: 8,
          seatingUse: "kids"
        },
        {
          id: "divider",
          type: "divider",
          name: "Divider",
          x: 300,
          y: 40,
          width: 16,
          height: 300,
          rotation: 90,
          seats: 0,
          seatingUse: "none"
        }
      ],
      () => `table-${(nextId += 1)}`
    );

    expect(tables).toEqual([
      expect.objectContaining({
        id: "table-1",
        mapObjectId: "adult-a",
        name: "Adult A",
        number: 1,
        side: "men",
        x: 10,
        y: 20,
        width: 80,
        height: 80,
        rotation: 5,
        isSeating: true
      }),
      expect.objectContaining({
        id: "table-2",
        mapObjectId: "adult-b",
        number: 2,
        side: "women",
        isSeating: true
      }),
      expect.objectContaining({
        id: "table-3",
        mapObjectId: "kids",
        number: 3,
        side: "kids",
        isSeating: true
      }),
      expect.objectContaining({
        id: "table-4",
        mapObjectId: "divider",
        number: 4,
        side: "men",
        isSeating: false
      })
    ]);
  });
});
