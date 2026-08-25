import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  prisma: {
    principalRole: { findMany: vi.fn() },
    principalPermission: { findMany: vi.fn() },
    organizationMembership: { findUnique: vi.fn() },
    serviceAccount: { findUnique: vi.fn() }
  }
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));

import {
  clearAccessCache,
  decide,
  loadEffectiveAccess,
  principalIdsHolding
} from "@/lib/authz/decide";
import { scoped, tenant, isInScope } from "@/lib/authz/authorize";
import type { ScopeFilter } from "@/lib/authz/types";

/**
 * The resolver.
 *
 * Two things here are subtle enough that getting them wrong is invisible to any
 * test that only checks allow/deny:
 *
 *   INV-3 - scope resolves PER PERMISSION, not per principal.
 *   INV-4 - DENY is subtractive, applied last, and nothing overrides it.
 */

const ORGANIZATION = "11111111-1111-4111-8111-111111111111";
const PRINCIPAL = "22222222-2222-4222-8222-222222222222";
const HALL_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const HALL_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SCHOOL_TYPE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

type Assignment = {
  scopeType: "org" | "hall" | "event_type";
  scopeId: string;
  expiresAt: Date | null;
  keys: string[];
};

function assignment(input: Assignment) {
  return {
    scopeType: input.scopeType,
    scopeId: input.scopeId,
    expiresAt: input.expiresAt,
    role: {
      rolePermissions: input.keys.map((key) => ({ permission: { key } }))
    }
  };
}

function override(effect: "GRANT" | "DENY", key: string) {
  return { effect, permission: { key } };
}

function setRows(assignments: unknown[], overrides: unknown[] = []) {
  mocks.prisma.principalRole.findMany.mockResolvedValue(assignments);
  mocks.prisma.principalPermission.findMany.mockResolvedValue(overrides);
}

beforeEach(() => {
  vi.clearAllMocks();
  clearAccessCache();
  setRows([]);
});

describe("INV-3: scope resolves per permission, not per principal", () => {
  it("keeps a hall-scoped key narrow while an org-scoped key stays wide", async () => {
    // The exact case the design calls out. Kitchen Staff at Hall A plus Viewer
    // organization-wide: the naive implementation unions every assignment's
    // scope once and applies it to every question, which silently widens
    // kitchen.status.update to everywhere. It passes every allow/deny test.
    setRows([
      assignment({
        scopeType: "hall",
        scopeId: HALL_A,
        expiresAt: null,
        keys: ["kitchen.status.update", "event.read"]
      }),
      assignment({
        scopeType: "org",
        scopeId: ORGANIZATION,
        expiresAt: null,
        keys: ["event.read"]
      })
    ]);

    const access = await loadEffectiveAccess(PRINCIPAL, ORGANIZATION);

    expect(access.permissions.get("kitchen.status.update")).toEqual({
      hallIds: [HALL_A],
      eventTypeIds: "all"
    });

    // event.read is carried by BOTH, and one of them is org-scoped.
    expect(access.permissions.get("event.read")).toEqual({
      hallIds: "all",
      eventTypeIds: "all"
    });
  });

  it("unions two hall-scoped assignments into both halls", async () => {
    setRows([
      assignment({
        scopeType: "hall",
        scopeId: HALL_A,
        expiresAt: null,
        keys: ["event.read"]
      }),
      assignment({
        scopeType: "hall",
        scopeId: HALL_B,
        expiresAt: null,
        keys: ["event.read"]
      })
    ]);

    const access = await loadEffectiveAccess(PRINCIPAL, ORGANIZATION);
    const scope = access.permissions.get("event.read") as ScopeFilter;

    expect(scope.hallIds).toEqual([HALL_A, HALL_B]);
    expect(scope.eventTypeIds).toBe("all");
  });

  it("narrows only its own dimension", async () => {
    // A hall-scoped assignment does not restrict event types, and vice versa.
    // That is what makes assignments union rather than intersect - and it is why
    // "kitchen at Hall A, but only for school events" is not expressible.
    setRows([
      assignment({
        scopeType: "hall",
        scopeId: HALL_A,
        expiresAt: null,
        keys: ["event.read"]
      })
    ]);

    let access = await loadEffectiveAccess(PRINCIPAL, ORGANIZATION);
    expect(access.permissions.get("event.read")?.eventTypeIds).toBe("all");

    clearAccessCache();
    setRows([
      assignment({
        scopeType: "event_type",
        scopeId: SCHOOL_TYPE,
        expiresAt: null,
        keys: ["event.read"]
      })
    ]);

    access = await loadEffectiveAccess(PRINCIPAL, ORGANIZATION);
    expect(access.permissions.get("event.read")?.hallIds).toBe("all");
    expect(access.permissions.get("event.read")?.eventTypeIds).toEqual([
      SCHOOL_TYPE
    ]);
  });

  it("does not intersect - two dimensions across two rows both widen", async () => {
    setRows([
      assignment({
        scopeType: "hall",
        scopeId: HALL_A,
        expiresAt: null,
        keys: ["event.read"]
      }),
      assignment({
        scopeType: "event_type",
        scopeId: SCHOOL_TYPE,
        expiresAt: null,
        keys: ["event.read"]
      })
    ]);

    const access = await loadEffectiveAccess(PRINCIPAL, ORGANIZATION);

    // The hall row leaves event types alone, so the union of the two is
    // unrestricted on both. Deliberate: intersection is the deferred
    // principal_role_scopes seam, not something to approximate here.
    expect(access.permissions.get("event.read")).toEqual({
      hallIds: "all",
      eventTypeIds: "all"
    });
  });
});

describe("INV-4: deny is subtractive and final", () => {
  it("refuses a key the principal's role grants", async () => {
    setRows(
      [
        assignment({
          scopeType: "org",
          scopeId: ORGANIZATION,
          expiresAt: null,
          keys: ["payment.refund", "invoice.read"]
        })
      ],
      [override("DENY", "payment.refund")]
    );

    const access = await loadEffectiveAccess(PRINCIPAL, ORGANIZATION);

    expect(access.permissions.has("payment.refund")).toBe(false);
    expect(access.denied.has("payment.refund")).toBe(true);
    expect(access.permissions.has("invoice.read")).toBe(true);
  });

  it("beats a GRANT override on the same key", async () => {
    // No priorities, no specificity rules, no "most specific wins" - those are
    // how policy engines become unreadable.
    setRows(
      [],
      [override("GRANT", "payment.refund"), override("DENY", "payment.refund")]
    );

    const access = await loadEffectiveAccess(PRINCIPAL, ORGANIZATION);

    expect(access.permissions.has("payment.refund")).toBe(false);
    expect(access.overridden.has("payment.refund")).toBe(false);
  });

  it("beats an owner-shaped role holding every key", async () => {
    setRows(
      [
        assignment({
          scopeType: "org",
          scopeId: ORGANIZATION,
          expiresAt: null,
          keys: ["payment.refund", "role.manage", "bank.connect"]
        })
      ],
      [override("DENY", "payment.refund")]
    );

    const access = await loadEffectiveAccess(PRINCIPAL, ORGANIZATION);

    expect(access.permissions.has("role.manage")).toBe(true);
    expect(access.permissions.has("payment.refund")).toBe(false);
  });

  it("grants org-wide, because an override is not scoped", async () => {
    setRows(
      [
        assignment({
          scopeType: "hall",
          scopeId: HALL_A,
          expiresAt: null,
          keys: ["event.read"]
        })
      ],
      [override("GRANT", "event.read")]
    );

    const access = await loadEffectiveAccess(PRINCIPAL, ORGANIZATION);

    expect(access.permissions.get("event.read")).toEqual({
      hallIds: "all",
      eventTypeIds: "all"
    });
  });
});

describe("expiry", () => {
  const past = new Date("2020-01-01T00:00:00.000Z");
  const future = new Date("2999-01-01T00:00:00.000Z");

  it("stops granting the moment it lapses, with no sweep job", async () => {
    setRows([
      assignment({
        scopeType: "org",
        scopeId: ORGANIZATION,
        expiresAt: past,
        keys: ["payment.refund"]
      })
    ]);

    const access = await loadEffectiveAccess(PRINCIPAL, ORGANIZATION);

    expect(access.permissions.has("payment.refund")).toBe(false);
    expect(access.expired.has("payment.refund")).toBe(true);
  });

  it("still grants before it lapses", async () => {
    setRows([
      assignment({
        scopeType: "org",
        scopeId: ORGANIZATION,
        expiresAt: future,
        keys: ["payment.refund"]
      })
    ]);

    const access = await loadEffectiveAccess(PRINCIPAL, ORGANIZATION);
    expect(access.permissions.has("payment.refund")).toBe(true);
  });

  it("keeps a key a live assignment also carries", async () => {
    setRows([
      assignment({
        scopeType: "org",
        scopeId: ORGANIZATION,
        expiresAt: past,
        keys: ["event.read"]
      }),
      assignment({
        scopeType: "hall",
        scopeId: HALL_A,
        expiresAt: null,
        keys: ["event.read"]
      })
    ]);

    const access = await loadEffectiveAccess(PRINCIPAL, ORGANIZATION);

    expect(access.permissions.get("event.read")).toEqual({
      hallIds: [HALL_A],
      eventTypeIds: "all"
    });
  });
});

describe("unknown keys", () => {
  it("ignores a seeded key with no union member", async () => {
    // Skipping is the safe direction, and the catalog test fails the build long
    // before this can matter in production.
    setRows([
      assignment({
        scopeType: "org",
        scopeId: ORGANIZATION,
        expiresAt: null,
        keys: ["event.read", "something.invented"]
      })
    ]);

    const access = await loadEffectiveAccess(PRINCIPAL, ORGANIZATION);

    expect(access.permissions.has("event.read")).toBe(true);
    expect(access.permissions.size).toBe(1);
  });
});

describe("the five gates", () => {
  function membership(overrides: Record<string, unknown> = {}) {
    return {
      isActive: true,
      principalId: PRINCIPAL,
      organization: {
        id: ORGANIZATION,
        name: "Org",
        slug: "org",
        isActive: true,
        subscriptionPlan: null,
        subscriptionStatus: "active",
        permissionsEpoch: BigInt(1)
      },
      principal: { isActive: true },
      user: {
        id: "user-1",
        name: "Test",
        email: "test@example.com",
        isActive: true
      },
      ...overrides
    };
  }

  it("denies with no-membership when there is no row", async () => {
    mocks.prisma.organizationMembership.findUnique.mockResolvedValue(null);

    const decision = await decide({
      principal: { kind: "user", userId: "user-1" },
      organizationId: ORGANIZATION,
      permission: "event.read"
    });

    expect(decision).toEqual({ allow: false, reason: "no-membership" });
  });

  it("denies with inactive when the principal is switched off", async () => {
    mocks.prisma.organizationMembership.findUnique.mockResolvedValue(
      membership({ principal: { isActive: false } })
    );

    const decision = await decide({
      principal: { kind: "user", userId: "user-1" },
      organizationId: ORGANIZATION,
      permission: "event.read"
    });

    expect(decision).toEqual({ allow: false, reason: "inactive" });
  });

  it("denies with no-permission when nothing grants the key", async () => {
    mocks.prisma.organizationMembership.findUnique.mockResolvedValue(
      membership()
    );
    setRows([]);

    const decision = await decide({
      principal: { kind: "user", userId: "user-1" },
      organizationId: ORGANIZATION,
      permission: "event.read"
    });

    expect(decision).toEqual({ allow: false, reason: "no-permission" });
  });

  it("allows with a scope, never a bare boolean", async () => {
    mocks.prisma.organizationMembership.findUnique.mockResolvedValue(
      membership()
    );
    setRows([
      assignment({
        scopeType: "hall",
        scopeId: HALL_A,
        expiresAt: null,
        keys: ["event.read"]
      })
    ]);

    const decision = await decide({
      principal: { kind: "user", userId: "user-1" },
      organizationId: ORGANIZATION,
      permission: "event.read"
    });

    expect(decision).toEqual({
      allow: true,
      scope: { hallIds: [HALL_A], eventTypeIds: "all" }
    });
  });

  it("treats a service token for another tenant as no membership", async () => {
    mocks.prisma.serviceAccount.findUnique.mockResolvedValue({
      name: "Kitchen display",
      expiresAt: null,
      principalId: PRINCIPAL,
      organizationId: "99999999-9999-4999-8999-999999999999",
      organization: {
        id: "99999999-9999-4999-8999-999999999999",
        name: "Other",
        slug: "other",
        isActive: true,
        subscriptionPlan: null,
        subscriptionStatus: "active",
        permissionsEpoch: BigInt(1)
      },
      principal: { isActive: true }
    });

    const decision = await decide({
      principal: { kind: "service", serviceAccountId: "service-1" },
      organizationId: ORGANIZATION,
      permission: "kitchen.read"
    });

    expect(decision).toEqual({ allow: false, reason: "no-membership" });
  });
});

describe("who holds a key", () => {
  it("adds GRANT overrides and subtracts DENY, like the resolver", async () => {
    mocks.prisma.principalRole.findMany.mockResolvedValue([
      { principalId: "p-1" },
      { principalId: "p-2" }
    ]);
    mocks.prisma.principalPermission.findMany.mockResolvedValue([
      { principalId: "p-3", effect: "GRANT" },
      { principalId: "p-2", effect: "DENY" }
    ]);

    const holders = await principalIdsHolding(ORGANIZATION, "role.manage");

    expect([...holders].sort()).toEqual(["p-1", "p-3"]);
  });
});

describe("query fragments", () => {
  const context = (scope: ScopeFilter) => ({
    organizationId: ORGANIZATION,
    scope
  });

  it("emits the tenant filter as a call, not an inline object", () => {
    expect(tenant(context({ hallIds: "all", eventTypeIds: "all" }))).toEqual({
      organizationId: ORGANIZATION
    });
  });

  it("emits nothing when the dimension is unrestricted", () => {
    expect(
      scoped(context({ hallIds: "all", eventTypeIds: "all" }), "hall")
    ).toEqual({});
  });

  it("emits an IN filter when it is", () => {
    expect(
      scoped(context({ hallIds: [HALL_A], eventTypeIds: "all" }), "hall")
    ).toEqual({ hallId: { in: [HALL_A] } });
  });

  it("respects a different column name", () => {
    expect(
      scoped(context({ hallIds: [HALL_A], eventTypeIds: "all" }), "hall", {
        field: "id"
      })
    ).toEqual({ id: { in: [HALL_A] } });
  });

  it("returns no rows for a principal scoped to nothing", () => {
    // The distinction the old `allowedHallIds` could not make: an empty array
    // means "scoped to nothing", not "unrestricted". Getting this backwards is
    // the one scoping bug that fails OPEN.
    expect(scoped(context({ hallIds: [], eventTypeIds: "all" }), "hall")).toEqual(
      { hallId: { in: [] } }
    );
  });

  it("answers the point check consistently with the list filter", () => {
    const narrow = context({ hallIds: [HALL_A], eventTypeIds: "all" });

    expect(isInScope(narrow, "hall", HALL_A)).toBe(true);
    expect(isInScope(narrow, "hall", HALL_B)).toBe(false);
    expect(
      isInScope(context({ hallIds: "all", eventTypeIds: "all" }), "hall", HALL_B)
    ).toBe(true);
  });
});
