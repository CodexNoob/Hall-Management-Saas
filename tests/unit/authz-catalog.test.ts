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
  it("holds exactly 62 keys", () => {
    // The count is asserted, not just the uniqueness. Sixty-two replacing
    // twenty-three booleans is the design's own claim, and a silent drift in
    // either direction means somebody added a key without deciding it was one.
    expect(permissionKeys).toHaveLength(62);
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
      (key) => !sources.includes(`"${key}"`)
    );

    expect(
      unreferenced,
      "these keys exist in the catalog but nothing enforces or renders them"
    ).toEqual([]);
  });
});
