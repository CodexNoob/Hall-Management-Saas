import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { starterRoles } from "@/lib/authz/starter-roles";

/**
 * INV-1: NO ROLE NAME APPEARS IN APPLICATION CODE.
 *
 * This is the test that keeps the headline property true, and it fails the
 * moment somebody writes `if (role === "admin")` for one urgent fix. Everything
 * else in the design is downstream of it: the catalog is fine-grained because
 * code has to ask about permissions, rank is a column because it cannot be a
 * constant, and the resolver returns a scope because a boolean cannot carry one.
 *
 * Role names live in exactly two places: rows in `roles`, and the seed data that
 * creates the starter set.
 */

const ROOT = path.resolve(__dirname, "../..");
const SCANNED = ["app", "features", "lib", "components"];

/**
 * The seed IS the definition, so it names them by construction. The fixture is
 * allowed to look one up so a UI test can say "what Kitchen Staff sees" without
 * restating 14 keys - it reads the definition rather than hard-coding a set.
 */
const ALLOWED = new Set([
  path.join("lib", "authz", "starter-roles.ts"),
  path.join("tests", "unit", "auth-session-fixture.ts")
]);

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

/**
 * The source with its comments blanked out.
 *
 * The invariant is about CODE. Explaining why a role name is not used -
 * "checked against `role.manage` rather than against a role named 'owner'" - is
 * the prose that keeps the next person from undoing it, and a test that forbids
 * writing that down would be paid for by deleting the explanations.
 *
 * Blanked rather than deleted so nothing on either side of a comment joins up
 * into a match that was never written.
 */
function codeOf(file: string): string {
  const source = readFileSync(file, "utf8");
  let out = "";
  let index = 0;

  while (index < source.length) {
    const two = source.slice(index, index + 2);

    if (two === "//") {
      const end = source.indexOf("\n", index);
      const stop = end === -1 ? source.length : end;
      out += " ".repeat(stop - index);
      index = stop;
      continue;
    }

    if (two === "/*") {
      const end = source.indexOf("*/", index + 2);
      const stop = end === -1 ? source.length : end + 2;
      // Newlines kept so a reported line number still means something.
      out += source.slice(index, stop).replace(/[^\n]/g, " ");
      index = stop;
      continue;
    }

    const char = source[index];

    if (char === '"' || char === "'" || char === "`") {
      out += char;
      index += 1;

      while (index < source.length && source[index] !== char) {
        if (source[index] === "\\") {
          out += source.slice(index, index + 2);
          index += 2;
          continue;
        }
        out += source[index];
        index += 1;
      }

      out += source[index] ?? "";
      index += 1;
      continue;
    }

    out += char;
    index += 1;
  }

  return out;
}

describe("INV-1: no role name appears in application code", () => {
  const files = SCANNED.flatMap((directory) => [
    ...walk(path.join(ROOT, directory))
  ]);

  it("scans a plausible number of files", () => {
    // A guard on the guard. If the walk ever returns nothing - a renamed
    // directory, a changed extension - every assertion below passes vacuously
    // and the invariant is unprotected with no failure to warn anyone.
    expect(files.length).toBeGreaterThan(200);
  });

  it.each(starterRoles.map((role) => role.key))(
    "does not mention the starter role key %s",
    (key) => {
      // Quoted only. An unquoted match hits ordinary words - "viewer" appears in
      // "viewerCount", "owner" in "ownerName" - and a test that cries wolf is
      // one somebody eventually deletes.
      const needle = new RegExp(`["'\`]${key}["'\`]`);
      const offenders = files.filter((file) => {
        const relative = path.relative(ROOT, file);

        if (ALLOWED.has(relative)) return false;

        return needle.test(codeOf(file));
      });

      expect(offenders.map((file) => path.relative(ROOT, file))).toEqual([]);
    }
  );

  it.each(starterRoles.map((role) => role.name))(
    "does not branch on the display name %s",
    (name) => {
      // Display names may be RENDERED from data, so only a comparison is a
      // violation: `=== "Owner"`, `case "Owner"`, `includes("Owner")`.
      const needle = new RegExp(
        `(===|!==|==|!=|case|includes\\(|startsWith\\()\\s*["'\`]${name}["'\`]`
      );
      const offenders = files.filter((file) => {
        const relative = path.relative(ROOT, file);

        if (ALLOWED.has(relative)) return false;

        return needle.test(codeOf(file));
      });

      expect(offenders.map((file) => path.relative(ROOT, file))).toEqual([]);
    }
  );

  it("has no administrator concept left anywhere", () => {
    // The specific shape this replaced: one predicate, thirteen call sites, each
    // a place a new role silently got either everything or nothing.
    const offenders = files.filter((file) =>
      /isAdministrativeRole|normalizeStaffRole|roleAccess\b/.test(codeOf(file))
    );

    expect(offenders.map((file) => path.relative(ROOT, file))).toEqual([]);
  });
});
