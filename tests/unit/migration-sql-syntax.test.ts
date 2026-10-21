import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * MIGRATIONS ARE SQL, NOT PRISMA SCHEMA, AND THE COMMENT SYNTAX DIFFERS.
 *
 * This exists because one of them shipped with `///` doc comments copied from
 * the habit of writing `schema.prisma`. Postgres has no `///` - the file was a
 * syntax error, `prisma migrate deploy` marked the migration failed, and P3009
 * then refused to apply ANY further migration until somebody resolved it by
 * hand. One stray character stopped every deployment.
 *
 * Cheap to check and impossible to notice by reading: `///` looks like a
 * comment, the editor even greys it out, and nothing complains until the
 * migration reaches a real database.
 */

const MIGRATIONS = path.join(process.cwd(), "prisma/migrations");

const migrationFiles = readdirSync(MIGRATIONS, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => ({
    name: entry.name,
    file: path.join(MIGRATIONS, entry.name, "migration.sql")
  }))
  .filter((entry) => existsSync(entry.file));

describe("migration SQL", () => {
  it("finds migrations to check", () => {
    // A guard that silently checks nothing is worse than no guard.
    expect(migrationFiles.length).toBeGreaterThan(20);
  });

  it("uses SQL comments, never Prisma schema doc comments", () => {
    const offenders = migrationFiles.filter(({ file }) =>
      /^\s*\/\/\//m.test(readFileSync(file, "utf8"))
    );

    expect(offenders.map((entry) => entry.name)).toEqual([]);
  });

  /**
   * `//` is not a comment in SQL either - MySQL and SQL Server do not have it
   * and neither does Postgres. It would fail the same way, so it is worth
   * catching in the same pass.
   */
  it("does not use double-slash comments either", () => {
    const offenders = migrationFiles.filter(({ file }) =>
      /^\s*\/\/(?!\/)/m.test(readFileSync(file, "utf8"))
    );

    expect(offenders.map((entry) => entry.name)).toEqual([]);
  });
});
