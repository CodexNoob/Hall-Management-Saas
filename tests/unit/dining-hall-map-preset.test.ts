import { describe, expect, it } from "vitest";

import {
  buildDiningTablesFromHallMapPresetObjects,
  diningTablesMatchPreset
} from "@/features/dining/components/dining-shared";

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

describe("dining plan divergence from its preset", () => {
  const objects = [
    {
      id: "adult-a",
      type: "round-table",
      name: "Adult A",
      x: 10,
      y: 20,
      width: 80,
      height: 80,
      rotation: 0,
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
    }
  ];
  const loaded = () => buildDiningTablesFromHallMapPresetObjects(objects);

  it("matches a freshly loaded preset despite the fresh ids", () => {
    // Ids are minted on every load; comparing them would report every plan as
    // modified the moment it was opened.
    expect(diningTablesMatchPreset(loaded(), objects)).toBe(true);
  });

  it("reports a dragged table as modified", () => {
    const tables = loaded();
    tables[0] = { ...tables[0], x: 400 };

    expect(diningTablesMatchPreset(tables, objects)).toBe(false);
  });

  it("reports a resized table as modified", () => {
    // The seats-per-table control rewrites every table, so it has to register.
    const tables = loaded().map((table) => ({ ...table, seats: 12 }));

    expect(diningTablesMatchPreset(tables, objects)).toBe(false);
  });

  it("reports a moved side as modified", () => {
    const tables = loaded();
    tables[0] = { ...tables[0], side: "kids" };

    expect(diningTablesMatchPreset(tables, objects)).toBe(false);
  });

  it("reports added and removed tables as modified", () => {
    expect(diningTablesMatchPreset(loaded().slice(1), objects)).toBe(false);
    expect(
      diningTablesMatchPreset(
        [...loaded(), { id: "extra", number: 3, seats: 10, side: "men" }],
        objects
      )
    ).toBe(false);
  });

  it("ignores renumbering, which is bookkeeping rather than an edit", () => {
    const tables = loaded()
      .slice()
      .reverse()
      .map((table, index) => ({ ...table, number: index + 1 }));

    expect(diningTablesMatchPreset(tables, objects)).toBe(true);
  });

  it("treats an empty or unreadable preset as unmatched", () => {
    expect(diningTablesMatchPreset(loaded(), null)).toBe(false);
    expect(diningTablesMatchPreset(loaded(), [])).toBe(false);
  });
});
