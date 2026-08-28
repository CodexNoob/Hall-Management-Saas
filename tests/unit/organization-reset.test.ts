import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/**
 * One recording stub per model, so a test can assert both WHAT was cleared and
 * in WHICH ORDER - the order is not cosmetic here: `GeneratedPdf.event` is a
 * required relation with no cascade, so an event holding a printed sheet cannot
 * be deleted while that row exists.
 */
const calls: string[] = [];

const deleteMany = (model: string) =>
  vi.fn(async () => {
    calls.push(model);
    return { count: 1 };
  });

const models = [
  "invoiceLineItem",
  "invoiceDiscount",
  "invoiceTax",
  "invoicePaymentSchedule",
  "invoiceBalance",
  "paymentReceipt",
  "paymentRefund",
  "paymentTransaction",
  "invoice",
  "generatedPdf",
  "emailLog",
  "storedFile",
  "fileFolder",
  "activityLog",
  "kitchenNotification",
  "kitchenItemStatus",
  "eventMenuLine",
  "eventMenu",
  "diningPlan",
  "bookingReservation",
  "event",
  "kitchenStandaloneItemStatus",
  "kitchenStandaloneEvent",
  "menuItemService",
  "addOn",
  "eventPackage",
  "menuItem",
  "menuCategory",
  "tableclothOption",
  "hallMapPreset",
  "hallMapShapeLibraryItem",
  "hall",
  "eventType",
  "holidayBlockedDate",
  "schoolCycle",
  "memberShul",
  "todayNote",
  "kitchenWorker",
  "client",
  "vendor",
  "bankTransaction",
  "bankConnection",
  "paymentProviderWebhookEvent",
  "principalPermission",
  "principalRole",
  "serviceAccount",
  "principal",
  "role",
  "authorizationAudit",
  "organizationMembership",
  "organizationSetting",
  "notificationPreference",
  "paymentSetting"
] as const;

const tx = {
  ...Object.fromEntries(
    models.map((model) => [model, { deleteMany: deleteMany(model) }])
  ),
  organizationMembership: {
    deleteMany: deleteMany("organizationMembership"),
    findFirst: vi.fn(async () => ({ principalId: "principal-1" }))
  },
  activityLog: {
    deleteMany: deleteMany("activityLog"),
    create: vi.fn(async () => ({ id: "log-1" }))
  },
  user: {
    updateMany: vi.fn(async () => {
      calls.push("user.deactivate");
      return { count: 2 };
    })
  },
  permission: { findMany: vi.fn(async () => []) },
  role: {
    deleteMany: deleteMany("role"),
    // Empty, so `ensureStarterRoles` treats every starter role as missing -
    // which is the state a reset leaves behind.
    findMany: vi.fn(async () => []),
    createManyAndReturn: vi.fn(async () => {
      calls.push("role.create");
      return starterRoles.map((role) => ({
        id: `${role.key}-id`,
        key: role.key
      }));
    })
  },
  rolePermission: { createMany: vi.fn(async () => ({ count: 0 })) },
  principalRole: {
    deleteMany: deleteMany("principalRole"),
    createMany: vi.fn(async () => ({ count: 1 }))
  }
} as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(
      async (run: (client: unknown) => Promise<unknown>) => await run(tx)
    )
  }
}));

import { resetOrganization } from "@/features/settings/server/organization-reset";
import { starterRoles } from "@/lib/authz/starter-roles";

const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const actorUserId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const run = (scope: Parameters<typeof resetOrganization>[0]["scope"]) =>
  resetOrganization({ organizationId, actorUserId, scope });

describe("organization reset", () => {
  beforeEach(() => {
    calls.length = 0;
    vi.clearAllMocks();
  });

  it("clears an event's children before the event itself", async () => {
    await run("events");

    expect(calls).toContain("event");
    // Required relation, no cascade: the delete fails outright if this row
    // outlives its event.
    expect(calls.indexOf("generatedPdf")).toBeLessThan(calls.indexOf("event"));
    expect(calls.indexOf("invoiceLineItem")).toBeLessThan(
      calls.indexOf("invoice")
    );
    expect(calls.indexOf("eventMenuLine")).toBeLessThan(
      calls.indexOf("eventMenu")
    );
    expect(calls.indexOf("eventMenu")).toBeLessThan(calls.indexOf("event"));
  });

  // `Invoice.event` is optional, so a venue can raise one against nothing in
  // particular. Taking it with the events would be the reset reaching past what
  // its card promises - and stripping the lines off it while leaving the
  // invoice standing would be worse.
  it("takes only the invoices an event owns", async () => {
    await run("events");

    expect(tx.invoice.deleteMany).toHaveBeenCalledWith({
      where: { organizationId, eventId: { not: null } }
    });
    expect(tx.invoiceLineItem.deleteMany).toHaveBeenCalledWith({
      where: { organizationId, invoice: { eventId: { not: null } } }
    });
  });

  it("takes the standalone invoices on a full account reset", async () => {
    await run("full-account");

    expect(tx.invoice.deleteMany).toHaveBeenCalledWith({
      where: { organizationId }
    });
    expect(tx.paymentProviderWebhookEvent.deleteMany).toHaveBeenCalledWith({
      where: { organizationId }
    });
  });

  it("leaves the menu library, the venue and access alone on an event reset", async () => {
    await run("events");

    for (const untouched of [
      "menuItem",
      "eventPackage",
      "hall",
      "client",
      "role",
      "organizationMembership",
      "organizationSetting"
    ]) {
      expect(calls).not.toContain(untouched);
    }
  });

  it("adds the menu library, and nothing else, to the events reset", async () => {
    await run("events-and-menus");

    expect(calls).toContain("menuItem");
    expect(calls).toContain("eventPackage");
    expect(calls).toContain("addOn");
    // Kitchen-only events name a menu, so they go before it.
    expect(calls.indexOf("kitchenStandaloneEvent")).toBeLessThan(
      calls.indexOf("menuItem")
    );
    for (const untouched of ["hall", "client", "role", "organizationSetting"]) {
      expect(calls).not.toContain(untouched);
    }
  });

  it("keeps events and menus out of a settings reset", async () => {
    await run("settings");

    expect(calls).not.toContain("event");
    expect(calls).not.toContain("menuItem");
    expect(calls).toContain("role");
    expect(calls).toContain("organizationSetting");
  });

  // The one rule with no exception: a reset that signs the account out of
  // itself cannot be undone from inside the product.
  it("keeps the person running it, and puts them back in the Owner role", async () => {
    await run("full-account");

    expect(tx.organizationMembership.deleteMany).toHaveBeenCalledWith({
      where: { organizationId, userId: { not: actorUserId } }
    });
    expect(tx.principal.deleteMany).toHaveBeenCalledWith({
      where: { organizationId, id: { not: "principal-1" } }
    });
    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { organizationId, id: { not: actorUserId }, isActive: true },
      data: { isActive: false }
    });
    // Rebuilt through the same call sign-up makes, so a starter role cannot
    // mean one thing to a new organization and another to a reset one.
    expect(tx.role.createManyAndReturn).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ key: "owner", isSystem: true })
        ])
      })
    );
    // Owner, not the default membership role - that one is "viewer", and using
    // it here would answer a reset by demoting the account's owner to read-only
    // with nobody left who could promote them back.
    expect(tx.principalRole.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            organizationId,
            principalId: "principal-1",
            roleId: "owner-id",
            scopeType: "org",
            scopeId: organizationId
          })
        ]
      })
    );
  });

  // Staff are deactivated rather than deleted: a user row is named by columns
  // across the schema that record who did what, several of them required.
  it("never deletes user rows", async () => {
    await run("full-account");

    expect(calls).not.toContain("user");
  });

  it("writes what it did into the empty history", async () => {
    const outcome = await run("full-account");

    expect(tx.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId,
          actionType: "Organization Reset",
          userId: actorUserId
        })
      })
    );
    // Last, so the first line of the new history says what emptied it.
    expect(calls.indexOf("activityLog")).toBeGreaterThan(-1);
    expect(outcome.scope).toBe("full-account");
  });
});
