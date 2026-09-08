import { describe, expect, it, vi } from "vitest";

import {
  changedFields,
  changedKeyPaths,
  recordActivity
} from "@/lib/audit/activity-log";

describe("recordActivity", () => {
  it("writes an organization-scoped activity entry", async () => {
    const create = vi.fn().mockResolvedValue({ id: "audit-1" });
    const prismaClient = { activityLog: { create } };

    await recordActivity(
      prismaClient,
      { organizationId: "org-1", userId: "user-1", actorName: "Ada" },
      {
        action: "plaid.connection.created",
        message: "Connected a bank account",
        changed: { before: { status: "pending" }, after: { status: "connected" } }
      }
    );

    expect(create).toHaveBeenCalledWith({
      data: {
        organizationId: "org-1",
        eventId: undefined,
        clientId: undefined,
        userId: "user-1",
        userName: "Ada",
        actionType: "plaid.connection.created",
        message: "Connected a bank account",
        oldValue: { status: "pending" },
        newValue: { status: "connected" }
      }
    });
  });

  it("leaves a service account's entry without a user", async () => {
    // A service account has no user row. The columns stay empty rather than
    // being filled with something invented, and `user_name` carries the token's
    // label so the entry still says who acted.
    const create = vi.fn().mockResolvedValue({ id: "audit-2" });

    await recordActivity(
      { activityLog: { create } },
      { organizationId: "org-1", userId: null, actorName: "Nightly sync" },
      { action: "menu.imported", message: "Imported 12 menu items." }
    );

    expect(create.mock.calls[0][0].data).toMatchObject({
      userId: undefined,
      userName: "Nightly sync",
      oldValue: undefined,
      newValue: undefined
    });
  });
});

describe("changedFields", () => {
  it("ignores fields that were not supplied", () => {
    // The panels post every field on every save, so "was it supplied" is not
    // the same question as "did it change".
    expect(
      changedFields({ name: "Soup", price: 10 }, { name: undefined })
    ).toEqual([]);
  });

  it("reports only the fields that actually moved", () => {
    expect(
      changedFields({ name: "Soup", price: 10 }, { name: "Soup", price: 12 })
    ).toEqual(["price"]);
  });

  it("compares dates by instant, not identity", () => {
    // Two Date objects for the same moment are never ===, so a naive comparison
    // would report a date change on every single save.
    const before = { eventDate: new Date("2026-05-01T00:00:00.000Z") };
    const after = { eventDate: new Date("2026-05-01T00:00:00.000Z") };

    expect(changedFields(before, after)).toEqual([]);
    expect(
      changedFields(before, { eventDate: new Date("2026-05-02T00:00:00.000Z") })
    ).toEqual(["eventDate"]);
  });
});

describe("changedKeyPaths", () => {
  it("names the paths that moved and never their values", () => {
    const paths = changedKeyPaths(
      { general: { contactEmail: "old@example.com", dateFormat: "MM/dd/yyyy" } },
      { general: { contactEmail: "new@example.com", dateFormat: "MM/dd/yyyy" } }
    );

    expect(paths).toEqual(["general.contactEmail"]);
    expect(JSON.stringify(paths)).not.toContain("example.com");
  });

  it("treats an absent key as unchanged", () => {
    expect(
      changedKeyPaths({ a: 1, b: 2 }, { a: 1, b: undefined })
    ).toEqual([]);
  });

  it("compares arrays structurally", () => {
    expect(changedKeyPaths({ halls: ["a"] }, { halls: ["a"] })).toEqual([]);
    expect(changedKeyPaths({ halls: ["a"] }, { halls: ["a", "b"] })).toEqual([
      "halls"
    ]);
  });
});
