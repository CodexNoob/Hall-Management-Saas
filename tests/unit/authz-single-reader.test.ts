import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * INV-2: ONE FUNCTION READS THE PRIVILEGE TABLES.
 *
 * `principals`, `principal_roles`, `principal_permissions` and
 * `role_permissions` are touched inside `lib/authz/` and nowhere else. There is
 * no second decision path, no "administrator shortcut" and no per-route
 * re-derivation - which is what makes a hole in this system findable by reading
 * one directory rather than fifty-six route files.
 *
 * Stated as "one module" in the design; enforced here as "one DIRECTORY, reads
 * and writes alike", which is strictly stronger and easier to keep honest.
 */

const ROOT = path.resolve(__dirname, "../..");

/** The Prisma delegates that reach a privilege table. */
const PRIVILEGE_DELEGATES = [
  "principal",
  "principalRole",
  "principalPermission",
  "rolePermission"
];

const ALLOWED_PREFIXES = [
  path.join("lib", "authz"),
  // The seed materializes the starter set, and it does it by calling into
  // lib/authz/provision.ts rather than writing the tables itself.
  path.join("prisma", "seed-authorization.ts"),
  path.join("prisma", "seed.ts"),
  // The suites that exercise the resolver necessarily name its delegates.
  path.join("tests", "unit", "authz-")
];

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

describe("INV-2: the privilege tables have one reader", () => {
  const files = ["app", "features", "lib", "components", "prisma", "tests"]
    .flatMap((directory) => [...walk(path.join(ROOT, directory))])
    .map((file) => ({
      relative: path.relative(ROOT, file),
      source: readFileSync(file, "utf8")
    }));

  it("scans a plausible number of files", () => {
    expect(files.length).toBeGreaterThan(200);
  });

  it.each(PRIVILEGE_DELEGATES)(
    "only lib/authz touches prisma.%s",
    (delegate) => {
      const needle = new RegExp(
        `\\b(?:prisma|transaction|client)\\.${delegate}\\.`
      );

      const offenders = files
        .filter(
          (file) =>
            !ALLOWED_PREFIXES.some((prefix) => file.relative.startsWith(prefix))
        )
        .filter((file) => needle.test(file.source))
        .map((file) => file.relative);

      expect(offenders).toEqual([]);
    }
  );

  it("keeps decide.ts as the only place assignments are folded into a verdict", () => {
    // The specific mistake this prevents: a route that "just needs to know which
    // halls" reimplementing the union, and getting the per-permission part wrong
    // in a way no allow/deny test would notice.
    const offenders = files
      .filter((file) => !file.relative.startsWith(path.join("lib", "authz")))
      .filter((file) => !file.relative.startsWith(path.join("tests", "unit")))
      .filter((file) => /rolePermissions\s*:/.test(file.source))
      .map((file) => file.relative);

    expect(offenders).toEqual([]);
  });

  it("has no leftover imports of the modules this replaced", () => {
    const dead = [
      "@/lib/auth/server-auth",
      "@/lib/auth/permissions",
      "@/lib/auth/roles",
      "@/lib/auth/guards",
      "@/lib/auth/catalog"
    ];

    for (const specifier of dead) {
      const offenders = files
        // This file names all five to look for them, so scanning itself would
        // report every one of them as an offender forever.
        .filter((file) => file.relative !== path.relative(ROOT, __filename))
        .filter((file) => file.source.includes(`"${specifier}"`))
        .map((file) => file.relative);

      expect(offenders, `${specifier} is gone but still imported`).toEqual([]);
    }
  });
});
