import { describe, expect, it } from "vitest";
import {
  assertAssignableRole,
  assertCanManageMember,
  assertNotSelfRoleChange,
  outranks,
  rankOfRole,
  roleRank
} from "@/lib/auth/guards";
import { AuthorizationError } from "@/lib/auth/errors";
import { staffRoleValues } from "@/lib/auth/permissions";

describe("roleRank", () => {
  // The test that fails when P1 adds a role and forgets to rank it.
  it("is total over staffRoleValues", () => {
    for (const role of staffRoleValues) {
      expect(roleRank[role], `no rank for "${role}"`).toBeTypeOf("number");
    }

    expect(Object.keys(roleRank).sort()).toEqual([...staffRoleValues].sort());
  });
});

describe("rankOfRole", () => {
  it("bridges the disagreement between the two normalizers", () => {
    // `normalizeStaffRole` only matches the unspaced form and would return
    // viewer here, but `isAdministrativeRole` - the one `requirePermission`
    // trusts - calls it administrative.
    expect(rankOfRole("Super Admin")).toBe(roleRank.owner);
    expect(rankOfRole("superadmin")).toBe(roleRank.owner);
    expect(rankOfRole("Administrator")).toBe(roleRank.admin);
  });

  it("falls back to viewer for anything unrecognised", () => {
    expect(rankOfRole("member")).toBe(roleRank.viewer);
    expect(rankOfRole(null)).toBe(roleRank.viewer);
    expect(rankOfRole("not-a-role")).toBe(roleRank.viewer);
  });
});

describe("outranks", () => {
  it("is strict, so equal rank never outranks", () => {
    expect(outranks("admin", "admin")).toBe(false);
    expect(outranks("owner", "owner")).toBe(false);
    // kitchen and billing are deliberate lateral peers.
    expect(outranks("kitchen", "billing")).toBe(false);
    expect(outranks("billing", "kitchen")).toBe(false);
  });

  it("ranks owner above admin above manager above viewer", () => {
    expect(outranks("owner", "admin")).toBe(true);
    expect(outranks("admin", "manager")).toBe(true);
    expect(outranks("manager", "viewer")).toBe(true);
    expect(outranks("viewer", "manager")).toBe(false);
  });
});

describe("assertAssignableRole", () => {
  it("refuses a role at or above the actor's own", () => {
    expect(() => assertAssignableRole("admin", "owner")).toThrow(
      AuthorizationError
    );
    expect(() => assertAssignableRole("admin", "admin")).toThrow(
      AuthorizationError
    );
    expect(() => assertAssignableRole("manager", "manager")).toThrow(
      AuthorizationError
    );
  });

  it("allows a role strictly below the actor's own", () => {
    expect(() => assertAssignableRole("owner", "admin")).not.toThrow();
    expect(() => assertAssignableRole("admin", "manager")).not.toThrow();
  });

  it("throws 403", () => {
    try {
      assertAssignableRole("viewer", "owner");
      expect.unreachable("should have thrown");
    } catch (error) {
      expect((error as AuthorizationError).status).toBe(403);
    }
  });
});

describe("assertCanManageMember", () => {
  it("refuses acting on a member at or above the actor's own rank", () => {
    expect(() => assertCanManageMember("admin", "owner")).toThrow(
      AuthorizationError
    );
    expect(() => assertCanManageMember("admin", "admin")).toThrow(
      AuthorizationError
    );
  });

  it("allows acting on somebody strictly below", () => {
    expect(() => assertCanManageMember("owner", "admin")).not.toThrow();
    expect(() => assertCanManageMember("manager", "viewer")).not.toThrow();
  });
});

describe("assertNotSelfRoleChange", () => {
  it("refuses when the actor is the subject", () => {
    expect(() => assertNotSelfRoleChange("user-1", "user-1")).toThrow(
      AuthorizationError
    );
  });

  it("allows acting on somebody else", () => {
    expect(() => assertNotSelfRoleChange("user-1", "user-2")).not.toThrow();
  });
});
