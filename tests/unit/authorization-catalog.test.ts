// @vitest-environment node

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  accessPermissionKeys,
  roleAccess,
  staffRoleValues
} from "@/lib/auth/permissions";
import { roleRank } from "@/lib/auth/guards";
import {
  keyByLegacyColumn,
  legacyColumnByKey,
  permissionCatalog,
  permissionKeysForSystemRole,
  roleTemplateCatalog,
  totalRolePermissionRows
} from "@/lib/auth/catalog";

/**
 * P1's controls.
 *
 * Two jobs. First, anti-drift: the 86 role_permission rows are DERIVED from the
 * compile-time matrix rather than restated as SQL literals, and these
 * assertions are what notices if the derivation and the matrix stop agreeing.
 * Second, the RLS lockdown: `membership_roles` and `membership_permissions`
 * must never acquire a tenant policy, and a comment is not a control.
 *
 * `roleRank` totality over `staffRoleValues` is asserted in
 * tests/unit/auth-guards.test.ts and deliberately not repeated here.
 */

const projectRoot = process.cwd();

/** Tables that must carry RLS with NO policy of any kind. */
const LOCKED_TABLES = [
  "permissions",
  "roles",
  "role_permissions",
  "membership_roles",
  "membership_permissions",
  "authorization_audit"
] as const;

const P1_MIGRATION = join(
  projectRoot,
  "prisma",
  "migrations",
  "20260825140000_p1_authorization_tables",
  "migration.sql"
);

function prismaSqlSources() {
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

describe("permission catalog", () => {
  it("covers every user_access column exactly once", () => {
    expect(permissionCatalog).toHaveLength(23);
    expect(permissionCatalog.map((entry) => entry.legacyColumn).sort()).toEqual(
      [...accessPermissionKeys].sort()
    );
  });

  it("has unique dotted keys", () => {
    const keys = permissionCatalog.map((entry) => entry.key);

    expect(new Set(keys).size).toBe(keys.length);

    // A key that survived as camelCase would silently become a second naming
    // convention, which is the thing renaming now was meant to avoid.
    for (const key of keys) {
      expect(key, `${key} should be dotted`).toMatch(
        /^[a-z][a-zA-Z]*\.[a-z][a-zA-Z]*$/
      );
    }
  });

  it("round-trips between key and legacy column", () => {
    for (const entry of permissionCatalog) {
      expect(legacyColumnByKey[entry.key]).toBe(entry.legacyColumn);
      expect(keyByLegacyColumn[entry.legacyColumn]).toBe(entry.key);
    }
  });

  it("renames canEditStaff to staff.edit", () => {
    // Named explicitly because it is the one the plan calls out, and because
    // it is the permission C3 was reachable through.
    expect(keyByLegacyColumn.canEditStaff).toBe("staff.edit");
  });

  it("marks exactly the escalates-privilege-or-moves-money keys dangerous", () => {
    // UNRESOLVED: the rule is provisional. This pins what P1 seeded so that
    // changing the rule is a visible diff rather than a silent reclassification.
    expect(
      permissionCatalog
        .filter((entry) => entry.isDangerous)
        .map((entry) => entry.key)
        .sort()
    ).toEqual([
      "payments.manage",
      "payments.sendEmail",
      "settings.edit",
      "staff.edit"
    ]);
  });

  it("pins the four keys the enforcement union does not accept", () => {
    // `Permission` in lib/auth/server-auth.ts carries 19 of the 23 columns.
    // These four are session-shaped: two filter which events a query returns,
    // one is always-true chrome, and home.niceBackground is a cosmetic
    // entitlement that is not an authorization decision at all. Whether the
    // catalog should record that distinction is an open question; this asserts
    // the population so the answer can be applied without re-deriving it.
    const notRouteEnforceable = [
      "canViewHome",
      "canSeeSchoolEvents",
      "canSeeSimchaEvents",
      "canUseNiceHomeBackground"
    ] as const;

    expect(notRouteEnforceable.map((column) => keyByLegacyColumn[column])).toEqual([
      "home.view",
      "school.viewEvents",
      "simcha.viewEvents",
      "home.niceBackground"
    ]);
  });
});

describe("system role templates", () => {
  it("is total over staffRoleValues", () => {
    expect(roleTemplateCatalog.map((template) => template.key).sort()).toEqual(
      [...staffRoleValues].sort()
    );
  });

  it("seeds rank from roleRank rather than restating it", () => {
    // The ceiling P0-A enforces and the ranks P1 seeds must be the same
    // numbers. If they drift, the database disagrees with the guards.
    for (const template of roleTemplateCatalog) {
      expect(template.rank).toBe(roleRank[template.key]);
    }
  });

  it("keeps kitchen and billing at equal rank", () => {
    // Lateral peers on purpose, and every comparison is strict, so equal rank
    // denies in both directions.
    expect(roleTemplateCatalog.find((t) => t.key === "kitchen")?.rank).toBe(
      roleTemplateCatalog.find((t) => t.key === "billing")?.rank
    );
  });
});

describe("role permission parity", () => {
  it("derives exactly the matrix, per role", () => {
    for (const role of staffRoleValues) {
      const derived = permissionKeysForSystemRole(role)
        .map((key) => legacyColumnByKey[key])
        .sort();
      const expected = accessPermissionKeys
        .filter((column) => roleAccess[role][column])
        .sort();

      expect(derived, `role ${role}`).toEqual(expected);
    }
  });

  it("derives the expected counts", () => {
    // Exact numbers, so a silent matrix edit shows up in the diff of this file
    // rather than only in behaviour.
    const counts = Object.fromEntries(
      staffRoleValues.map((role) => [
        role,
        permissionKeysForSystemRole(role).length
      ])
    );

    expect(counts).toEqual({
      owner: 23,
      admin: 23,
      manager: 17,
      billing: 9,
      kitchen: 8,
      viewer: 6
    });
    expect(totalRolePermissionRows()).toBe(86);
  });

  it("keeps admin byte-identical to owner", () => {
    // Why the P0-A ceiling makes Administrator owner-only to create: the two
    // matrices are the same, so minting an admin mints a co-equal.
    expect(permissionKeysForSystemRole("admin")).toEqual(
      permissionKeysForSystemRole("owner")
    );
  });
});

describe("authorization table lockdown", () => {
  it("gives the new tables no policy anywhere under prisma/", () => {
    // The one that matters most is membership_permissions. Every row there
    // means "this member holds this permission", and a tenant policy's
    // WITH CHECK asks only whether the writer is a member of the organization -
    // which they are. Any member could grant themselves anything in it.
    // FOR SELECT is not sufficient either; it would expose every colleague's
    // grant map. So: no policy at all.
    const offenders: string[] = [];

    for (const { name, sql } of prismaSqlSources()) {
      for (const match of sql.matchAll(
        /CREATE\s+POLICY\s+[^\s]+\s+ON\s+(?:public\.)?"?([a-z0-9_]+)"?/gi
      )) {
        if ((LOCKED_TABLES as readonly string[]).includes(match[1])) {
          offenders.push(`${name}: policy on ${match[1]}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("keeps the new tables out of the tenant policy loop", () => {
    // Both membership tables carry organization_id - for the composite foreign
    // key, not to opt in. They would pass the mechanical "does it have
    // organization_id?" test somebody will apply to this array one day.
    const sql = readFileSync(
      join(projectRoot, "prisma", "supabase-rls.sql"),
      "utf8"
    );
    const arrayBlock = sql.match(/FOREACH[\s\S]*?ARRAY\s*\[([\s\S]*?)\]/i);

    expect(arrayBlock).not.toBeNull();

    const looped = [...arrayBlock![1].matchAll(/'([a-z0-9_]+)'/g)].map(
      (match) => match[1]
    );

    for (const table of LOCKED_TABLES) {
      expect(looped, `${table} must not be in the tenant loop`).not.toContain(
        table
      );
    }
  });

  it("enables RLS and revokes from anon and authenticated on all six", () => {
    const sql = readFileSync(P1_MIGRATION, "utf8");

    for (const table of LOCKED_TABLES) {
      expect(sql).toMatch(
        new RegExp(
          `ALTER\\s+TABLE\\s+"?${table}"?\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`,
          "i"
        )
      );
      expect(sql).toMatch(
        new RegExp(
          `REVOKE\\s+ALL\\s+ON\\s+TABLE\\s+public\\.${table}\\s+FROM\\s+anon,\\s*authenticated`,
          "i"
        )
      );
    }
  });
});

describe("objects invisible to Prisma", () => {
  // Triggers, CHECK constraints and NULLS NOT DISTINCT do not appear in
  // schema.prisma, so a diff-based tool would propose dropping them. These
  // assertions are what makes that a failing build rather than a silent
  // regression.
  const sql = () => readFileSync(P1_MIGRATION, "utf8");

  it("creates the roles unique index with NULLS NOT DISTINCT", () => {
    // Without it two system templates could both be keyed 'owner', because
    // standard SQL treats every NULL as distinct.
    expect(sql()).toMatch(
      /CREATE\s+UNIQUE\s+INDEX\s+"roles_organization_id_key_key"[\s\S]*?NULLS\s+NOT\s+DISTINCT/i
    );
  });

  it("creates the membership_roles tenant-match trigger", () => {
    // A composite FK onto roles(id, organization_id) cannot express this:
    // roles.organization_id is nullable and MATCH SIMPLE satisfies any FK with
    // a NULL component vacuously, skipping exactly the rows it must cover.
    expect(sql()).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.assert_membership_role_tenant/i);
    expect(sql()).toMatch(
      /CREATE\s+TRIGGER\s+"membership_roles_assert_tenant"[\s\S]*?BEFORE\s+INSERT\s+OR\s+UPDATE\s+ON\s+"membership_roles"/i
    );
  });

  it("constrains membership_permissions.effect", () => {
    expect(sql()).toMatch(/CHECK\s*\(\s*"effect"\s+IN\s*\(\s*'GRANT',\s*'DENY'\s*\)\s*\)/i);
  });

  it("adds the composite FK target on organization_memberships", () => {
    expect(sql()).toMatch(
      /ADD\s+CONSTRAINT\s+"organization_memberships_id_organization_id_key"\s+UNIQUE\s*\(\s*"id",\s*"organization_id"\s*\)/i
    );
  });
});

describe("P1 stays inert", () => {
  it("has no reader or writer in app, features or lib", () => {
    // The phase's defining property. lib/auth/catalog.ts is the seed's source
    // data, not a consumer: it names no Prisma model.
    const roots = ["app", "features", "lib"];
    const models = [
      "membershipRole",
      "membershipPermission",
      "rolePermission",
      "authorizationAudit",
      "permissionsEpoch"
    ];
    const offenders: string[] = [];

    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);

        if (entry.isDirectory()) {
          walk(path);
          continue;
        }

        if (!/\.(ts|tsx)$/.test(entry.name)) {
          continue;
        }

        const source = readFileSync(path, "utf8");

        for (const model of models) {
          if (new RegExp(`\\bprisma\\.${model}\\b`).test(source)) {
            offenders.push(`${path}: prisma.${model}`);
          }
        }
      }
    };

    for (const root of roots) {
      walk(join(projectRoot, root));
    }

    expect(
      offenders,
      "P1 introduces the authorization tables with zero application traffic. " +
        "A reader or writer here means the phase is no longer inert - that work belongs in P2 or P3."
    ).toEqual([]);
  });
});
