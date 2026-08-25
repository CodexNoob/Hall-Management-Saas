// @vitest-environment node

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * P0-B's control.
 *
 * The five tables below decide who may do what. A policy on them that says
 * FOR ALL means: if `authenticated` is ever granted write privileges on the
 * schema, any member of an organization may rewrite any colleague's role,
 * permissions, active status, or the organization's own settings. FOR SELECT
 * means the same grant degrades to read exposure.
 *
 * None of this executes today - `authenticated` holds no privilege on any table
 * in public, and Prisma connects as the table owner, which bypasses RLS
 * entirely. That is exactly why a test is the right control and a comment is
 * not: there is no runtime behaviour to notice a regression, so the only thing
 * that can notice is the build.
 *
 * The specific regression this exists to catch: prisma/supabase-rls.sql is run
 * by hand via `npm run db:rls` and unconditionally re-creates policies. Moving
 * one of these tables back into its tenant loop would silently revert the
 * migration on the next run, on the database every branch shares.
 */

const projectRoot = process.cwd();

/**
 * organizations and organization_settings are here for entitlement reasons:
 * subscription and trial fields on the first, and the `integrations` JSON on
 * the second, which holds roleAccessOverrides, two_factor_required and
 * session_timeout_minutes.
 */
// Four, not five. `user_access` was the fifth and is gone: the RBAC migration
// replaced its boolean columns with `principal_roles` / `principal_permissions`,
// which are handled far more strictly - RLS on, everything revoked, and no
// policy at all. Those are covered by tests/unit/authz-single-reader.ts.
const PRIVILEGE_TABLES = [
  "organizations",
  "organization_memberships",
  "users",
  "organization_settings"
] as const;

function sqlSources() {
  const sources: Array<{ name: string; sql: string }> = [
    {
      name: "supabase-rls.sql",
      sql: readFileSync(join(projectRoot, "prisma", "supabase-rls.sql"), "utf8")
    }
  ];

  const migrationsDir = join(projectRoot, "prisma", "migrations");

  for (const entry of readdirSync(migrationsDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      sources.push({
        name: entry.name,
        sql: readFileSync(join(migrationsDir, entry.name, "migration.sql"), "utf8")
      });
    }
  }

  return sources;
}

/**
 * Policies reach these tables two ways, and both have to be read.
 *
 * Directly, as `CREATE POLICY x ON public.foo ... FOR ALL`; and indirectly,
 * through a `DO $$ ... FOREACH t IN ARRAY[...] ... format('CREATE POLICY ... ON
 * public.%I FOR ALL ...')` block, where the table name only ever appears as a
 * quoted literal inside the array. The second is how supabase-rls.sql drives
 * most of the schema, so reading only the first would miss the case that
 * actually matters.
 */
function forAllPolicyTargets(sql: string) {
  const targets = new Set<string>();

  for (const match of sql.matchAll(
    /CREATE\s+POLICY\s+\S+\s+ON\s+(?:public\.)?"?([a-z0-9_]+)"?([\s\S]{0,300}?)(?:;|$)/gi
  )) {
    if (/\bFOR\s+ALL\b/i.test(match[2])) {
      targets.add(match[1]);
    }
  }

  // Every DO block, not just the first: a second array further down the file is
  // exactly the kind of thing a maintainer would add without noticing that a
  // single-match regex stops looking after the first one.
  for (const block of sql.matchAll(/DO\s+\$\$([\s\S]*?)\$\$\s*;/gi)) {
    const body = block[1];

    if (!/\bFOR\s+ALL\b/i.test(body)) {
      continue;
    }

    for (const arrayBlock of body.matchAll(/ARRAY\s*\[([\s\S]*?)\]/gi)) {
      for (const name of arrayBlock[1].matchAll(/'([a-z0-9_]+)'/g)) {
        targets.add(name[1]);
      }
    }
  }

  return targets;
}

describe("privilege table policies", () => {
  it("never puts a privilege table behind a FOR ALL policy", () => {
    const offenders: string[] = [];

    for (const { name, sql } of sqlSources()) {
      const targets = forAllPolicyTargets(sql);

      for (const table of PRIVILEGE_TABLES) {
        if (targets.has(table)) {
          offenders.push(`${name}: FOR ALL policy reaches ${table}`);
        }
      }
    }

    expect(
      offenders,
      "A FOR ALL policy on one of these tables means a future blanket " +
        "GRANT to `authenticated` would let any organization member rewrite " +
        "any colleague's privileges through PostgREST. Narrow it to FOR SELECT."
    ).toEqual([]);
  });

  it("still grants each privilege table a FOR SELECT policy", () => {
    // The narrowing must be a narrowing, not a deletion. A table with no policy
    // at all would also pass the assertion above while quietly changing what
    // the file is understood to promise.
    const sql = readFileSync(
      join(projectRoot, "prisma", "supabase-rls.sql"),
      "utf8"
    );

    for (const table of PRIVILEGE_TABLES) {
      expect(sql, `${table} should carry a FOR SELECT policy`).toMatch(
        new RegExp(
          `CREATE\\s+POLICY\\s+\\S+\\s+ON\\s+public\\.${table}\\s+FOR\\s+SELECT`,
          "i"
        )
      );
    }
  });

  it("keeps the privilege tables out of every tenant loop in db:rls", () => {
    // They were removed from the array deliberately. Adding one back is the
    // single most likely way this regresses, because the array is where a
    // maintainer looks when wiring up RLS for anything new.
    const sql = readFileSync(
      join(projectRoot, "prisma", "supabase-rls.sql"),
      "utf8"
    );

    const looped = new Set<string>();

    for (const block of sql.matchAll(/FOREACH[\s\S]*?ARRAY\s*\[([\s\S]*?)\]/gi)) {
      for (const name of block[1].matchAll(/'([a-z0-9_]+)'/g)) {
        looped.add(name[1]);
      }
    }

    expect(looped.size).toBeGreaterThan(20);

    for (const table of PRIVILEGE_TABLES) {
      expect([...looped], `${table} must not be loop-managed`).not.toContain(
        table
      );
    }
  });

  it("finds policies to check at all", () => {
    // Guards the guard. If the regexes silently stop matching, every assertion
    // above passes by testing nothing - which is the failure mode of a static
    // check that nobody can observe at runtime.
    const sql = readFileSync(
      join(projectRoot, "prisma", "supabase-rls.sql"),
      "utf8"
    );

    expect(forAllPolicyTargets(sql).size).toBeGreaterThan(20);
  });
});
