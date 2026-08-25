import { describe, expect, it } from "vitest";

import { AuthorizationError } from "@/lib/auth/errors";
import type { PermissionKey } from "@/lib/authz/catalog";
import {
  UNRANKED,
  assertEpochCurrent,
  assertNotLastOwner,
  assertNotSelfElevation,
  assertRankCeiling,
  assertRoleMutable,
  assertRoleNotInUse,
  assertSubset,
  parseEpochPrecondition,
  parsePermissionKeys
} from "@/lib/authz/guards";

/**
 * The escalation suite.
 *
 * Self-elevation, rank ceiling, amplification, last-owner - and the one that
 * matters most: an actor lacking a key cannot create, edit, or assign any role
 * containing it.
 *
 * Every assertion here checks the CODE as well as the refusal. The browser
 * branches on the code; the prose is for a human and changes freely, so a test
 * that only matched the message would go green on a rename that broke the UI.
 */

function codeOf(run: () => void): string {
  try {
    run();
  } catch (error) {
    if (error instanceof AuthorizationError) return error.code ?? "";
    throw error;
  }

  throw new Error("Expected a refusal, got none.");
}

function statusOf(run: () => void): number {
  try {
    run();
  } catch (error) {
    if (error instanceof AuthorizationError) return error.status;
    throw error;
  }

  throw new Error("Expected a refusal, got none.");
}

const held = (...keys: PermissionKey[]) => new Set<PermissionKey>(keys);

describe("INV-6: nothing grants more than the granter holds", () => {
  it("refuses a key the actor does not hold", () => {
    expect(
      codeOf(() =>
        assertSubset(held("invoice.read"), ["payment.refund"])
      )
    ).toBe("amplification");
  });

  it("names the offending keys, so the message is actionable", () => {
    try {
      assertSubset(held("invoice.read"), ["payment.refund", "bank.connect"]);
      throw new Error("Expected a refusal.");
    } catch (error) {
      expect(error).toBeInstanceOf(AuthorizationError);
      expect((error as AuthorizationError).details).toEqual({
        permissions: ["bank.connect", "payment.refund"]
      });
    }
  });

  it("permits a strict subset", () => {
    expect(() =>
      assertSubset(held("invoice.read", "payment.record"), ["invoice.read"])
    ).not.toThrow();
  });

  it("permits granting nothing", () => {
    expect(() => assertSubset(held(), [])).not.toThrow();
  });

  it("permits an exact match", () => {
    expect(() =>
      assertSubset(held("role.assign"), ["role.assign"])
    ).not.toThrow();
  });

  it("is the guard that survives custom roles", () => {
    // The scenario rank alone cannot answer: an actor at rank 300 outranks a
    // custom role at 400, but that role contains a key they do not hold.
    const actorAt300 = held("event.read", "event.update");
    const customRoleAt400: PermissionKey[] = ["event.read", "payment.refund"];

    expect(() => assertRankCeiling(300, 400, "assign")).not.toThrow();
    expect(codeOf(() => assertSubset(actorAt300, customRoleAt400))).toBe(
      "amplification"
    );
  });
});

describe("rank ceiling", () => {
  it("refuses at equal rank - comparisons are strict", () => {
    // Strictness is what makes it safe for two lateral peers to share a number.
    expect(codeOf(() => assertRankCeiling(300, 300, "assign"))).toBe(
      "rank_ceiling"
    );
  });

  it("refuses above", () => {
    expect(codeOf(() => assertRankCeiling(300, 200, "act"))).toBe(
      "rank_ceiling"
    );
  });

  it("permits strictly below", () => {
    expect(() => assertRankCeiling(200, 300, "assign")).not.toThrow();
  });

  it("refuses everything for an actor holding no role at all", () => {
    // UNRANKED outranks nobody, so a principal with no live assignment cannot
    // act on anyone - including somebody else who also holds nothing.
    expect(codeOf(() => assertRankCeiling(UNRANKED, 500, "act"))).toBe(
      "rank_ceiling"
    );
    expect(codeOf(() => assertRankCeiling(UNRANKED, UNRANKED, "act"))).toBe(
      "rank_ceiling"
    );
  });

  it("permits acting on someone who holds nothing", () => {
    expect(() => assertRankCeiling(500, UNRANKED, "act")).not.toThrow();
  });
});

describe("self-elevation", () => {
  it("refuses when the actor is the subject", () => {
    expect(codeOf(() => assertNotSelfElevation("p-1", "p-1"))).toBe(
      "self_elevation"
    );
  });

  it("permits acting on somebody else", () => {
    expect(() => assertNotSelfElevation("p-1", "p-2")).not.toThrow();
  });
});

describe("last owner", () => {
  it("refuses a change that would leave nobody able to manage roles", () => {
    expect(codeOf(() => assertNotLastOwner(0))).toBe("last_owner");
    expect(statusOf(() => assertNotLastOwner(0))).toBe(409);
  });

  it("permits it while somebody remains", () => {
    expect(() => assertNotLastOwner(1)).not.toThrow();
  });
});

describe("starter roles", () => {
  it("refuses to delete one", () => {
    expect(codeOf(() => assertRoleMutable({ isSystem: true }, "delete"))).toBe(
      "system_role_immutable"
    );
  });

  it("refuses to rename its key", () => {
    expect(codeOf(() => assertRoleMutable({ isSystem: true }, "rename"))).toBe(
      "system_role_immutable"
    );
  });

  it("leaves a tenant-authored role alone", () => {
    expect(() =>
      assertRoleMutable({ isSystem: false }, "delete")
    ).not.toThrow();
  });
});

describe("role in use", () => {
  it("refuses to delete a role people still hold", () => {
    expect(codeOf(() => assertRoleNotInUse(3))).toBe("role_in_use");
  });

  it("counts correctly in the message", () => {
    try {
      assertRoleNotInUse(1);
      throw new Error("Expected a refusal.");
    } catch (error) {
      expect((error as AuthorizationError).message).toContain("One person");
    }
  });

  it("permits deleting an unheld role", () => {
    expect(() => assertRoleNotInUse(0)).not.toThrow();
  });
});

describe("permission keys are refused, never dropped", () => {
  it("rejects an unknown key with 422", () => {
    expect(statusOf(() => parsePermissionKeys(["event.read", "nope.nope"]))).toBe(
      422
    );
    expect(codeOf(() => parsePermissionKeys(["nope.nope"]))).toBe(
      "invalid_permission_key"
    );
  });

  it("rejects a non-array", () => {
    expect(codeOf(() => parsePermissionKeys("event.read"))).toBe(
      "invalid_permission_key"
    );
  });

  it("de-duplicates a valid list", () => {
    expect(parsePermissionKeys(["event.read", "event.read"])).toEqual([
      "event.read"
    ]);
  });

  it("accepts an empty list - a role that grants nothing is legitimate", () => {
    expect(parsePermissionKeys([])).toEqual([]);
  });
});

describe("optimistic concurrency", () => {
  const request = (ifMatch?: string) =>
    new Request("http://localhost/api/access/roles", {
      headers: ifMatch ? { "If-Match": ifMatch } : {}
    });

  it("reads the epoch out of If-Match", () => {
    expect(parseEpochPrecondition(request('"epoch:41"'))).toBe(41);
  });

  it("accepts the weak form and a bare value", () => {
    expect(parseEpochPrecondition(request('W/"epoch:41"'))).toBe(41);
    expect(parseEpochPrecondition(request("epoch:41"))).toBe(41);
  });

  it("treats an absent header as no precondition", () => {
    // Server-to-server callers and the assignment dialog have nothing to collide
    // with, so requiring the header would make them all fail for no benefit.
    expect(parseEpochPrecondition(request())).toBeNull();
  });

  it("refuses a malformed header rather than ignoring it", () => {
    expect(codeOf(() => parseEpochPrecondition(request("garbage")))).toBe(
      "invalid_permission_key"
    );
  });

  it("refuses a stale epoch and reports the current one", () => {
    try {
      assertEpochCurrent(41, 43);
      throw new Error("Expected a refusal.");
    } catch (error) {
      expect(error).toBeInstanceOf(AuthorizationError);
      expect((error as AuthorizationError).status).toBe(409);
      expect((error as AuthorizationError).code).toBe("epoch_stale");
      expect((error as AuthorizationError).details).toEqual({
        currentEpoch: 43
      });
    }
  });

  it("permits a current epoch", () => {
    expect(() => assertEpochCurrent(43, 43)).not.toThrow();
  });

  it("permits no precondition at all", () => {
    expect(() => assertEpochCurrent(null, 43)).not.toThrow();
  });
});
