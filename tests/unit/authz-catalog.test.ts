import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  PERMISSION_GROUPS,
  groupedPermissionCatalog,
  permissionCatalog,
  permissionKeys,
  sortOrderOf
} from "@/lib/authz/catalog";

/**
 * INV-5: THE CATALOG IS THE ONLY ENUMERATED SET IN CODE.
 *
 * Permission keys are a compile-time union because a typo at a call site must be
 * a build failure. Roles, ranks, assignments, scopes and overrides are rows.
 * Adding a key is a code change on purpose; adding a role is not.
 */

const ROOT = path.resolve(__dirname, "../..");

/**
 * Catalog keys whose FEATURE does not exist yet, each with the gap it names.
 *
 * Deliberately shaped like PUBLIC_ROUTES in authz-route-coverage.test.ts: an
 * entry here is a visible line in a diff, so shipping an unenforceable key is a
 * decision somebody reviews rather than something a test silently tolerates.
 *
 * This is NOT a place to park a key whose route you forgot to guard. The test
 * below fails the moment a listed key becomes enforced, so the list cannot rot
 * into a set of stale excuses - and every one of these is a permission an
 * administrator can tick today with no effect anywhere, which is exactly the
 * state it records.
 */
const NOT_YET_WIRED: Record<string, string> = {
  "event.delete":
    "No DELETE handler on /api/events. Deletion is a soft `deleted` flag that no route sets.",
  "client.delete":
    "No DELETE handler on /api/clients. The route exposes GET, POST and PATCH only.",
  "integration.manage":
    "No connect-or-configure endpoint exists. /api/integrations/google-drive only reports whether the deployment is configured, which is a file.read question.",
  "schoolcycle.read":
    "The SchoolCycle model is in the schema with no route and no dashboard page behind it.",
  "schoolcycle.manage":
    "Same gap as schoolcycle.read - the recurring schedule has a table and nothing that reads or writes it."
};

function* walk(directory: string): Generator<string> {
  for (const entry of readdirSync(directory)) {
    const full = path.join(directory, entry);

    if (statSync(full).isDirectory()) {
      yield* walk(full);
      continue;
    }

    if (/\.(ts|tsx)$/.test(entry)) yield full;
  }
}

describe("permission catalog", () => {
  it("holds exactly 63 keys", () => {
    // The count is asserted, not just the uniqueness. Replacing twenty-three
    // booleans is the design's own claim, and a silent drift in either direction
    // means somebody added a key without deciding it was one.
    //
    // Sixty-three since `kitchen.read.all` split the board into "may open it"
    // and "may see all of it", which is what lets Kitchen Staff be scoped to
    // their own dishes.
    expect(permissionKeys).toHaveLength(63);
  });

  it("has no duplicates", () => {
    expect(new Set(permissionKeys).size).toBe(permissionKeys.length);
  });

  it("uses dotted lowercase keys", () => {
    for (const key of permissionKeys) {
      expect(key, `${key} is not resource.action`).toMatch(
        /^[a-z]+(\.[a-z]+){1,2}$/
      );
    }
  });

  it("never pairs manage with create/update/delete on one resource", () => {
    // The rule that stops sixty-two becoming two hundred: `manage` means the
    // whole lifecycle. A resource carrying both says the author changed their
    // mind halfway and left two ways to express the same grant.
    const byResource = new Map<string, Set<string>>();

    for (const key of permissionKeys) {
      const segments = key.split(".");
      const verb = segments[segments.length - 1];
      const resource = segments.slice(0, -1).join(".");

      const verbs = byResource.get(resource) ?? new Set<string>();
      verbs.add(verb);
      byResource.set(resource, verbs);
    }

    for (const [resource, verbs] of byResource) {
      if (!verbs.has("manage")) continue;

      for (const conflicting of ["create", "update", "delete"]) {
        expect(
          verbs.has(conflicting),
          `${resource} has both "manage" and "${conflicting}"`
        ).toBe(false);
      }
    }
  });

  it("files every key under a declared group", () => {
    for (const entry of permissionCatalog) {
      expect(PERMISSION_GROUPS).toContain(entry.group);
    }
  });

  it("keeps each group contiguous, so render order matches file order", () => {
    const seen: string[] = [];

    for (const entry of permissionCatalog) {
      if (seen[seen.length - 1] !== entry.group) seen.push(entry.group);
    }

    expect(
      seen.length,
      "a group appears in two separate runs, so the editor would render it twice"
    ).toBe(new Set(seen).size);
  });

  it("gives every entry a label and a description", () => {
    for (const entry of permissionCatalog) {
      expect(entry.label.length, `${entry.key} has no label`).toBeGreaterThan(2);
      expect(
        entry.description.length,
        `${entry.key} has no description`
      ).toBeGreaterThan(10);
    }
  });

  it("derives sort order from file order", () => {
    expect(sortOrderOf(permissionKeys[0])).toBe(0);
    expect(sortOrderOf(permissionKeys[permissionKeys.length - 1])).toBe(
      permissionKeys.length - 1
    );
  });

  it("renders every key through the grouped view", () => {
    const rendered = groupedPermissionCatalog().flatMap(
      (section) => section.permissions
    );

    expect(rendered).toHaveLength(permissionKeys.length);
  });

  it("marks exactly the keys that escalate privilege or move money", () => {
    const dangerous = permissionCatalog
      .filter((entry) => entry.isDangerous)
      .map((entry) => entry.key)
      .sort();

    expect(dangerous).toEqual([
      "bank.connect",
      "invoice.void",
      "payment.notify",
      "payment.record",
      "payment.refund",
      "permission.override",
      "role.assign",
      "role.manage",
      "staff.deactivate"
    ]);
  });

  it("references every key from at least one server call site", () => {
    // A key nothing enforces is not a permission. This is the half of INV-5 that
    // stops the catalog filling with aspirational entries an administrator can
    // tick with no effect anywhere.
    const sources = ["app", "features", "lib"]
      .flatMap((directory) => [...walk(path.join(ROOT, directory))])
      .filter(
        (file) =>
          !file.includes(path.join("lib", "authz", "catalog.ts")) &&
          !file.includes(path.join("lib", "authz", "starter-roles.ts"))
      )
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");

    const unreferenced = permissionKeys.filter(
      (key) => !sources.includes(`"${key}"`) && !(key in NOT_YET_WIRED)
    );

    expect(
      unreferenced,
      "these keys exist in the catalog but nothing enforces or renders them"
    ).toEqual([]);
  });

  it("keeps the not-yet-wired list honest", () => {
    // The list above is only safe while it stays a list of GAPS. An entry for a
    // key that has since been wired reads as an open question that is actually
    // closed, and the next unenforced key added beside it inherits the excuse.
    const sources = ["app", "features", "lib"]
      .flatMap((directory) => [...walk(path.join(ROOT, directory))])
      .filter(
        (file) =>
          !file.includes(path.join("lib", "authz", "catalog.ts")) &&
          !file.includes(path.join("lib", "authz", "starter-roles.ts"))
      )
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");

    for (const [key, reason] of Object.entries(NOT_YET_WIRED)) {
      expect(
        permissionKeys,
        `${key} is listed as not-yet-wired but is not in the catalog`
      ).toContain(key);
      expect(
        reason.length,
        `${key} has no reason recorded`
      ).toBeGreaterThan(20);
      expect(
        sources.includes(`"${key}"`),
        `${key} is enforced now - take it off the not-yet-wired list`
      ).toBe(false);
    }
  });
});
