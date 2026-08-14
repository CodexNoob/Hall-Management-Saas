// @vitest-environment node

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Row-level security in this project is applied from two places: the hand-run
 * `npm run db:rls` script, and ad-hoc blocks at the end of some migrations. A
 * new table is therefore UNPROTECTED by default, and nothing tells you - which
 * is exactly how `contact_support_requests` shipped without RLS while
 * `support_tickets`, added six hours earlier, got the full treatment.
 *
 * This is the thing that notices. It is deliberately static - it reads the
 * schema and the SQL rather than connecting to a database - so it runs in the
 * normal unit suite and fails on the commit that introduces the gap, instead of
 * during an audit months later.
 *
 * Note what this does NOT prove: that the SQL has actually been applied to any
 * particular Supabase project. It proves the intent exists in the repo.
 */

const projectRoot = process.cwd();

function read(...segments: string[]) {
  return readFileSync(join(projectRoot, ...segments), "utf8");
}

/** Every physical table Prisma will create, via its @@map name. */
function schemaTables() {
  const schema = read("prisma", "schema.prisma");

  return new Set(
    [...schema.matchAll(/@@map\("([a-z0-9_]+)"\)/g)].map((match) => match[1])
  );
}

/**
 * Every table any SQL in the repo enables RLS on - whether through the
 * `db:rls` script's table array, a direct ALTER TABLE, or a migration.
 */
function protectedTables() {
  const sources = [read("prisma", "supabase-rls.sql")];
  const migrationsDir = join(projectRoot, "prisma", "migrations");

  for (const entry of readdirSync(migrationsDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      sources.push(read("prisma", "migrations", entry.name, "migration.sql"));
    }
  }

  const covered = new Set<string>();

  for (const sql of sources) {
    // Direct: ALTER TABLE public.foo ENABLE ROW LEVEL SECURITY
    for (const match of sql.matchAll(
      /ALTER\s+TABLE\s+(?:public\.)?"?([a-z0-9_]+)"?\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi
    )) {
      covered.add(match[1]);
    }

    // The db:rls script drives its list through a FOREACH over a table array,
    // so the names only ever appear as quoted literals inside that array.
    const arrayBlock = sql.match(/FOREACH[\s\S]*?ARRAY\s*\[([\s\S]*?)\]/i);

    if (arrayBlock) {
      for (const match of arrayBlock[1].matchAll(/'([a-z0-9_]+)'/g)) {
        covered.add(match[1]);
      }
    }
  }

  return covered;
}

describe("row-level security coverage", () => {
  it("enables RLS on every table in the Prisma schema", () => {
    const tables = [...schemaTables()].sort();
    const covered = protectedTables();
    const unprotected = tables.filter((table) => !covered.has(table));

    expect(
      unprotected,
      `These tables exist in prisma/schema.prisma but no SQL in this repo enables row-level security on them. ` +
        `Supabase grants the anon role access to public tables by default, so an unprotected table is readable ` +
        `by anyone holding the anon key - which ships in the client bundle. Add them to the array in ` +
        `prisma/supabase-rls.sql, or to their own migration.`
    ).toEqual([]);
  });

  it("finds tables to check at all", () => {
    // Guards the guard: a regex that silently stops matching would make the
    // assertion above pass by testing nothing.
    expect(schemaTables().size).toBeGreaterThan(40);
    expect(protectedTables().size).toBeGreaterThan(40);
  });
});
