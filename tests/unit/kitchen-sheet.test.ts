import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { buildKitchenSheet } from "@/features/kitchen/server/kitchen-sheet";

/**
 * The sheet builder is what the kitchen cooks off, and it is now the only copy:
 * the event workspace's Kitchen tab and the board both run it. So the cases that
 * matter are the ones where it must refuse to produce a number rather than
 * produce a wrong one - a sheet printing "0 dips" because nobody drew the tables
 * is worse than one saying it cannot work the number out.
 *
 * No mocks: the builder takes rows and returns a sheet.
 */

const menuItemId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

/** 40 couples + 50 men + 45 ladies + 6 boys + 4 girls + 2 kids = 187 guests. */
function event(overrides: Record<string, unknown> = {}) {
  return {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    hallId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    couplesCount: 40,
    menCount: 50,
    ladiesCount: 45,
    boysCount: 6,
    girlsCount: 4,
    kidsCount: 2,
    waitersCount: 8,
    diningPlan: null,
    ...overrides
  } as never;
}

function rule(overrides: Record<string, unknown> = {}) {
  const { quantity = 1, ...rest } = overrides;

  return {
    serviceStyle: "Buffet",
    // A Decimal, not a number: the column is Decimal(10,3), so this is what
    // Prisma hands the builder, and the rule schema wants a number.
    quantity: new Prisma.Decimal(String(quantity)),
    unit: "tray",
    per: 30,
    perBasis: "TotalGuests",
    rounding: "Up",
    minimumUnits: null,
    ...rest
  };
}

function line(overrides: Record<string, unknown> = {}) {
  return {
    id: "line-1",
    menuItemId,
    addOnId: null,
    itemName: null,
    serviceStyle: "Buffet",
    notes: null,
    sortOrder: 0,
    menuItem: {
      name: "Potato kugel",
      isActive: true,
      picturePath: null,
      services: [rule()]
    },
    addOn: null,
    ...overrides
  };
}

function menu(lines: Array<Record<string, unknown>>) {
  return {
    meal: "Main",
    status: "Draft",
    confirmedAt: null,
    version: 1,
    lines
  } as never;
}

function build(
  lines: Array<Record<string, unknown>>,
  options: {
    eventOverrides?: Record<string, unknown>;
    statuses?: Array<Record<string, unknown>>;
    signedUrlsByPath?: Map<string, string>;
  } = {}
) {
  return buildKitchenSheet({
    event: event(options.eventOverrides),
    meal: "Main",
    menu: menu(lines),
    statuses: (options.statuses ?? []) as never,
    signedUrlsByPath: options.signedUrlsByPath
  });
}

describe("kitchen sheet builder", () => {
  it("counts guests without the waiters", () => {
    const sheet = build([line()]);

    expect(sheet.counts.totalGuests).toBe(187);
    expect(sheet.counts.waiters).toBe(8);
  });

  it("runs the rule for the style the line is served in", () => {
    const sheet = build([line()]);

    // 187 / 30 = 6.233, rounded up because you cannot cook a third of a tray.
    expect(sheet.lines[0].countState).toBe("Counted");
    expect(sheet.lines[0].quantities).toEqual([
      { unit: "tray", units: 7, raw: 6.233333 }
    ]);
  });

  it("ignores rules belonging to a style this line is not served in", () => {
    const sheet = build([
      line({
        serviceStyle: "Plated",
        menuItem: {
          name: "Potato kugel",
          isActive: true,
          picturePath: null,
          services: [rule()]
        }
      })
    ]);

    // A Buffet rule says nothing about a plated portion, so this is "no rule
    // for how we are serving it", not a quantity of zero.
    expect(sheet.lines[0].countState).toBe("NoRule");
    expect(sheet.lines[0].quantities).toEqual([]);
  });

  describe("refusing to invent a number", () => {
    it("asks for a style when the dish is served more than one way", () => {
      const sheet = build([
        line({
          serviceStyle: null,
          menuItem: {
            name: "Potato kugel",
            isActive: true,
            picturePath: null,
            services: [rule(), rule({ serviceStyle: "Plated", per: 1 })]
          }
        })
      ]);

      expect(sheet.lines[0].countState).toBe("NeedsStyle");
      expect(sheet.summary.needsAttention).toBe(1);
    });

    it("reports a dish with no counting rule at all", () => {
      const sheet = build([
        line({
          serviceStyle: null,
          menuItem: {
            name: "Israeli salad",
            isActive: true,
            picturePath: null,
            services: []
          }
        })
      ]);

      expect(sheet.lines[0].countState).toBe("NoRule");
      expect(sheet.summary.needsAttention).toBe(1);
    });

    it("reports a per-table rule on an event with no dining plan", () => {
      const sheet = build([
        line({
          menuItem: {
            name: "Dips",
            isActive: true,
            picturePath: null,
            services: [rule({ perBasis: "Tables", per: 1 })]
          }
        })
      ]);

      expect(sheet.lines[0].countState).toBe("Unresolved");
      expect(sheet.lines[0].unresolvedBases).toEqual(["Tables"]);
      expect(sheet.summary.unresolvedBases).toEqual(["Tables"]);
    });

    it("treats a plan with no seating tables as unanswered, not as zero", () => {
      // The dining page saves a plan as soon as anyone edits the counts beside
      // it, long before a table is drawn, and the column defaults to `[]`.
      const sheet = build(
        [
          line({
            menuItem: {
              name: "Dips",
              isActive: true,
              picturePath: null,
              services: [rule({ perBasis: "Tables", per: 1 })]
            }
          })
        ],
        { eventOverrides: { diningPlan: { tables: [] } } }
      );

      expect(sheet.counts.tables).toBeNull();
      expect(sheet.lines[0].countState).toBe("Unresolved");
    });

    it("counts drawn seating tables when there are some", () => {
      const sheet = build(
        [
          line({
            menuItem: {
              name: "Dips",
              isActive: true,
              picturePath: null,
              services: [rule({ perBasis: "Tables", per: 1, quantity: 2 })]
            }
          })
        ],
        {
          eventOverrides: {
            diningPlan: {
              tables: [
                { id: "t1", number: 1, seats: 10, side: "men" },
                { id: "t2", number: 2, seats: 10, side: "women" },
                // Not seating, so not a table anyone eats at.
                { id: "t3", number: 3, seats: 0, side: "head" }
              ]
            }
          }
        }
      );

      expect(sheet.counts.tables).toBe(2);
      expect(sheet.lines[0].quantities).toEqual([
        { unit: "tray", units: 4, raw: 4 }
      ]);
    });
  });

  describe("statuses", () => {
    it("summarises what is done, pending and untouched", () => {
      const sheet = build(
        [
          line(),
          line({ id: "line-2", menuItemId: "other", serviceStyle: "Buffet" }),
          line({ id: "line-3", menuItemId: "third", serviceStyle: "Buffet" })
        ],
        {
          statuses: [
            {
              menuItemId,
              status: "COMPLETE",
              assignedWorker: { name: "Mendy" }
            },
            { menuItemId: "other", status: "PENDING", assignedWorker: null }
          ]
        }
      );

      expect(sheet.summary).toMatchObject({
        dishes: 3,
        complete: 1,
        pending: 1,
        notStarted: 1,
        needsAttention: 0
      });
      expect(sheet.lines[0].assignedWorkerName).toBe("Mendy");
    });

    it("reads a row that only records a worker as not started", () => {
      // Assigning someone says who is doing a dish, not that it has begun. The
      // card's cycle starts at nothing, and a name against it must not spend
      // that first step.
      const sheet = build([line()], {
        statuses: [
          { menuItemId, status: null, assignedWorker: { name: "Mendy" } }
        ]
      });

      expect(sheet.lines[0].status).toBeNull();
      expect(sheet.lines[0].assignedWorkerName).toBe("Mendy");
      expect(sheet.summary).toMatchObject({ notStarted: 1, pending: 0 });
    });

    it("reads an unrecognised stored status as started but not finished", () => {
      // The column is plain text, guarded only by a zod enum on the board's
      // PATCH, so anything else that reached it must not be trusted through as
      // "done".
      const sheet = build([line()], {
        statuses: [{ menuItemId, status: "IN_PROGRESS", assignedWorker: null }]
      });

      expect(sheet.lines[0].status).toBe("PENDING");
    });

    it("leaves an add-on statusless and uncounted", () => {
      const sheet = build([
        line({
          id: "line-addon",
          menuItemId: null,
          addOnId: "add-on-1",
          serviceStyle: null,
          menuItem: null,
          addOn: {
            name: "Chocolate fountain",
            isActive: true,
            picturePath: null
          }
        })
      ]);

      // `KitchenItemStatus` is keyed by menu item, so an add-on has nowhere to
      // record one - and it is not cooked to a rule either.
      expect(sheet.lines[0].countState).toBe("NotCounted");
      expect(sheet.lines[0].status).toBeNull();
      expect(sheet.summary).toMatchObject({ dishes: 0, addOns: 1 });
    });
  });

  describe("names and pictures", () => {
    it("prefers a confirmed line's own snapshot over the library name", () => {
      const sheet = build([line({ itemName: "Kugel (as sold)" })]);

      expect(sheet.lines[0].name).toBe("Kugel (as sold)");
    });

    it("follows the library while the line has no snapshot", () => {
      const sheet = build([line()]);

      expect(sheet.lines[0].name).toBe("Potato kugel");
    });

    it("flags an item deactivated since it was put on the menu", () => {
      const sheet = build([
        line({
          menuItem: {
            name: "Potato kugel",
            isActive: false,
            picturePath: null,
            services: [rule()]
          }
        })
      ]);

      expect(sheet.lines[0].isRetired).toBe(true);
    });

    it("hands over a signed url and never the path behind it", () => {
      const sheet = build(
        [
          line({
            menuItem: {
              name: "Potato kugel",
              isActive: true,
              picturePath: "org/menu/kugel.jpg",
              services: [rule()]
            }
          })
        ],
        {
          signedUrlsByPath: new Map([
            ["org/menu/kugel.jpg", "https://storage.example/signed"]
          ])
        }
      );

      expect(sheet.lines[0].pictureUrl).toBe("https://storage.example/signed");
      expect(JSON.stringify(sheet)).not.toContain("org/menu/kugel.jpg");
    });

    it("answers null for a picture nobody signed", () => {
      // What the board does: it draws a ratio, not thumbnails, so signing four
      // weeks of pictures would be a storage round-trip per event for nothing.
      const sheet = build([
        line({
          menuItem: {
            name: "Potato kugel",
            isActive: true,
            picturePath: "org/menu/kugel.jpg",
            services: [rule()]
          }
        })
      ]);

      expect(sheet.lines[0].pictureUrl).toBeNull();
    });
  });

  it("answers an empty draft for an event with no menu row yet", () => {
    const sheet = buildKitchenSheet({
      event: event(),
      meal: "Main",
      menu: null,
      statuses: []
    });

    expect(sheet.menuStatus).toBe("Draft");
    expect(sheet.version).toBe(0);
    expect(sheet.lines).toEqual([]);
    expect(sheet.summary).toMatchObject({ dishes: 0, needsAttention: 0 });
  });
});
