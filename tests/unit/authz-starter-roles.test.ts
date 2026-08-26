import { describe, expect, it } from "vitest";

import { permissionKeys, type PermissionKey } from "@/lib/authz/catalog";
import {
  DEFAULT_MEMBERSHIP_ROLE_KEY,
  FOUNDING_OWNER_ROLE_KEY,
  starterRoles,
  totalStarterRolePermissionRows
} from "@/lib/authz/starter-roles";

/**
 * The starter matrix, every role against every one of the sixty-two keys.
 *
 * THE NEGATIVE CASES CARRY THE WEIGHT. A matrix test that only checks what each
 * role HAS passes just as happily when a role has everything, which is the exact
 * failure it exists to catch.
 */

function roleFor(key: string) {
  const role = starterRoles.find((candidate) => candidate.key === key);
  if (!role) throw new Error(`No starter role keyed "${key}".`);
  return role;
}

const OWNER = roleFor("owner");
const ADMINISTRATOR = roleFor("administrator");
const EVENT_MANAGER = roleFor("event-manager");
const KITCHEN_MANAGER = roleFor("kitchen-manager");
const KITCHEN_STAFF = roleFor("kitchen-staff");
const VIEWER = roleFor("viewer");

function holds(
  role: { permissions: readonly PermissionKey[] },
  key: PermissionKey
) {
  return role.permissions.includes(key);
}

describe("starter roles", () => {
  it("ships exactly six", () => {
    expect(starterRoles).toHaveLength(6);
  });

  it("ranks them sparsely, so a tenant can interleave without renumbering", () => {
    // Kitchen Manager took 350 - one of the gaps the sparse scheme exists to
    // provide - rather than renumbering Kitchen Staff, whose rank a tenant may
    // already have reasoned about when composing roles of their own.
    expect(starterRoles.map((role) => role.rank)).toEqual([
      100, 200, 300, 350, 400, 500
    ]);
  });

  it("has no duplicate keys or ranks", () => {
    expect(new Set(starterRoles.map((role) => role.key)).size).toBe(6);
    expect(new Set(starterRoles.map((role) => role.rank)).size).toBe(6);
  });

  it("grants only keys that exist in the catalog", () => {
    for (const role of starterRoles) {
      for (const key of role.permissions) {
        expect(permissionKeys, `${role.key} grants unknown ${key}`).toContain(
          key
        );
      }
    }
  });

  it("never grants the same key twice within a role", () => {
    for (const role of starterRoles) {
      expect(new Set(role.permissions).size, `${role.key} has duplicates`).toBe(
        role.permissions.length
      );
    }
  });

  it("names roles the provisioning path can find", () => {
    const keys = starterRoles.map((role) => role.key);

    expect(keys).toContain(DEFAULT_MEMBERSHIP_ROLE_KEY);
    expect(keys).toContain(FOUNDING_OWNER_ROLE_KEY);
  });

  it("writes a known number of rows per organization", () => {
    expect(totalStarterRolePermissionRows()).toBe(
      OWNER.permissions.length +
        ADMINISTRATOR.permissions.length +
        EVENT_MANAGER.permissions.length +
        KITCHEN_MANAGER.permissions.length +
        KITCHEN_STAFF.permissions.length +
        VIEWER.permissions.length
    );
  });

  describe("exact counts", () => {
    it.each([
      [OWNER, 63],
      [ADMINISTRATOR, 60],
      [EVENT_MANAGER, 41],
      [KITCHEN_MANAGER, 15],
      // Eleven, down from fourteen: `kitchen.event.create`,
      // `kitchen.worker.assign` and `eventmenu.confirm` moved to Kitchen Manager.
      [KITCHEN_STAFF, 11],
      [VIEWER, 15]
    ])("$key holds %i keys", (role, expected) => {
      expect(role.permissions).toHaveLength(expected as number);
    });
  });

  describe("Owner", () => {
    it("holds everything", () => {
      expect([...OWNER.permissions].sort()).toEqual([...permissionKeys].sort());
    });
  });

  describe("Administrator", () => {
    it("is refused role.manage - the difference that makes it a distinct role", () => {
      // Owner and Administrator being genuinely different, rather than the same
      // matrix at two ranks, is entirely these three rows.
      expect(holds(ADMINISTRATOR, "role.manage")).toBe(false);
      expect(holds(ADMINISTRATOR, "permission.override")).toBe(false);
      expect(holds(ADMINISTRATOR, "bank.connect")).toBe(false);
    });

    it("may still assign roles that already exist", () => {
      expect(holds(ADMINISTRATOR, "role.assign")).toBe(true);
      expect(holds(ADMINISTRATOR, "role.read")).toBe(true);
    });

    it("holds everything else", () => {
      const missing = permissionKeys.filter(
        (key) => !holds(ADMINISTRATOR, key)
      );

      expect(missing.sort()).toEqual([
        "bank.connect",
        "permission.override",
        "role.manage"
      ]);
    });
  });

  describe("Event Manager", () => {
    it("owns bookings and events outright", () => {
      for (const key of [
        "booking.create",
        "booking.cancel",
        "event.create",
        "event.update",
        "event.delete",
        "event.status.update"
      ] as PermissionKey[]) {
        expect(holds(EVENT_MANAGER, key), `should hold ${key}`).toBe(true);
      }
    });

    it("takes payments but cannot refund, void, or touch the bank", () => {
      expect(holds(EVENT_MANAGER, "payment.record")).toBe(true);
      expect(holds(EVENT_MANAGER, "payment.notify")).toBe(true);
      expect(holds(EVENT_MANAGER, "invoice.read")).toBe(true);

      expect(holds(EVENT_MANAGER, "payment.refund")).toBe(false);
      expect(holds(EVENT_MANAGER, "invoice.void")).toBe(false);
      expect(holds(EVENT_MANAGER, "bank.connect")).toBe(false);
    });

    it("draws maps but does not create halls", () => {
      expect(holds(EVENT_MANAGER, "hallmap.update")).toBe(true);
      expect(holds(EVENT_MANAGER, "hall.read")).toBe(true);
      expect(holds(EVENT_MANAGER, "hall.manage")).toBe(false);
    });

    it("keeps clients but cannot delete one", () => {
      expect(holds(EVENT_MANAGER, "client.create")).toBe(true);
      expect(holds(EVENT_MANAGER, "client.update")).toBe(true);
      expect(holds(EVENT_MANAGER, "client.delete")).toBe(false);
    });

    it("cannot replace the menu wholesale", () => {
      expect(holds(EVENT_MANAGER, "menu.update")).toBe(true);
      expect(holds(EVENT_MANAGER, "menu.delete")).toBe(false);
      expect(holds(EVENT_MANAGER, "menu.import")).toBe(false);
    });

    it("sees the directory and hands out nothing", () => {
      expect(holds(EVENT_MANAGER, "staff.read")).toBe(true);
      expect(holds(EVENT_MANAGER, "staff.invite")).toBe(false);
      expect(holds(EVENT_MANAGER, "role.assign")).toBe(false);
      expect(holds(EVENT_MANAGER, "permission.override")).toBe(false);
    });
  });

  describe("Kitchen Manager", () => {
    it("supervises the kitchen", () => {
      expect(holds(KITCHEN_MANAGER, "kitchen.status.update")).toBe(true);
      expect(holds(KITCHEN_MANAGER, "kitchen.event.create")).toBe(true);
      expect(holds(KITCHEN_MANAGER, "kitchen.worker.assign")).toBe(true);
      expect(holds(KITCHEN_MANAGER, "eventmenu.confirm")).toBe(true);
      expect(holds(KITCHEN_MANAGER, "kitchen.read.all")).toBe(true);
    });

    it("supervises the kitchen and nothing else", () => {
      // Rank 350 puts it above the cooks, which says who it may act on - never
      // what it may reach. The office half of Event Manager is not its business.
      for (const key of [
        "event.create",
        "menu.create",
        "client.read",
        "invoice.read",
        "payment.record",
        "staff.read",
        "settings.read"
      ] as PermissionKey[]) {
        expect(holds(KITCHEN_MANAGER, key), `must not hold ${key}`).toBe(false);
      }
    });
  });

  describe("Kitchen Staff", () => {
    it("runs production and directs nobody", () => {
      expect(holds(KITCHEN_STAFF, "kitchen.read")).toBe(true);
      expect(holds(KITCHEN_STAFF, "kitchen.status.update")).toBe(true);
      expect(holds(KITCHEN_STAFF, "kitchen.worker.read")).toBe(true);

      // The split: everything that directs other people's work moved to Kitchen
      // Manager. A cook marks their own dishes done and hands out nothing.
      expect(holds(KITCHEN_STAFF, "kitchen.event.create")).toBe(false);
      expect(holds(KITCHEN_STAFF, "kitchen.worker.assign")).toBe(false);
      expect(holds(KITCHEN_STAFF, "eventmenu.confirm")).toBe(false);
    });

    it("is scoped to its own dishes by the absence of kitchen.read.all", () => {
      // The one negative that the kitchen routes read directly: without this key
      // they send a caller only the lines assigned to them. It is deliberately an
      // absence rather than a flag, so a role nobody has looked at cannot quietly
      // acquire the whole board.
      expect(holds(KITCHEN_STAFF, "kitchen.read.all")).toBe(false);
    });

    it("is refused every money key", () => {
      for (const key of [
        "invoice.read",
        "invoice.create",
        "invoice.update",
        "invoice.void",
        "payment.record",
        "payment.refund",
        "payment.notify",
        "bank.connect",
        "report.read"
      ] as PermissionKey[]) {
        expect(holds(KITCHEN_STAFF, key), `must not hold ${key}`).toBe(false);
      }
    });

    it("is refused every access key", () => {
      for (const key of [
        "staff.read",
        "staff.invite",
        "staff.update",
        "staff.deactivate",
        "role.read",
        "role.manage",
        "role.assign",
        "permission.override",
        "audit.read"
      ] as PermissionKey[]) {
        expect(holds(KITCHEN_STAFF, key), `must not hold ${key}`).toBe(false);
      }
    });

    it("cannot write to the event record itself", () => {
      expect(holds(KITCHEN_STAFF, "event.read")).toBe(true);
      expect(holds(KITCHEN_STAFF, "event.update")).toBe(false);
      expect(holds(KITCHEN_STAFF, "booking.create")).toBe(false);
    });
  });

  describe("Viewer", () => {
    it("is refused every write in the catalog", () => {
      const writeVerbs = [
        "create",
        "update",
        "delete",
        "manage",
        "assign",
        "import",
        "confirm",
        "cancel",
        "void",
        "record",
        "refund",
        "notify",
        "connect",
        "invite",
        "deactivate",
        "generate",
        "override"
      ];

      const writes = permissionKeys.filter((key) =>
        writeVerbs.includes(key.split(".").pop() ?? "")
      );

      // A sanity check on the filter itself: if it ever matched nothing, the
      // assertion below would pass while testing nothing.
      expect(writes.length).toBeGreaterThan(30);

      for (const key of writes) {
        expect(holds(VIEWER, key), `Viewer must not hold ${key}`).toBe(false);
      }
    });

    it("still sees enough to be useful", () => {
      expect(holds(VIEWER, "calendar.read")).toBe(true);
      expect(holds(VIEWER, "event.read")).toBe(true);
      expect(holds(VIEWER, "client.read")).toBe(true);
    });
  });

  describe("the role that is deliberately absent", () => {
    it("could be composed from the catalog with no code change", () => {
      // A bookkeeper is the design's own test of itself. If every key it needs
      // exists, composing one is a role editor and eleven checkboxes.
      const bookkeeper: PermissionKey[] = [
        "invoice.read",
        "invoice.create",
        "invoice.update",
        "invoice.void",
        "payment.record",
        "payment.refund",
        "payment.notify",
        "report.read",
        "client.read",
        "file.read",
        "event.read"
      ];

      for (const key of bookkeeper) {
        expect(permissionKeys).toContain(key);
      }

      expect(
        starterRoles.some(
          (role) =>
            role.permissions.length === bookkeeper.length &&
            bookkeeper.every((key) => role.permissions.includes(key))
        ),
        "a bookkeeper role is meant to be absent from the starter set"
      ).toBe(false);
    });
  });
});
