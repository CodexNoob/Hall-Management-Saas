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

/**
 * Tables that must carry RLS with NO policy of any kind, mapped to the
 * migration that locks each one down. `role_templates` and
 * `role_template_permissions` arrived in P1B, the rest in P1.
 */
const LOCKED_TABLES = {
  permissions: "20260825140000_p1_authorization_tables",
  roles: "20260825140000_p1_authorization_tables",
  role_permissions: "20260825140000_p1_authorization_tables",
  membership_roles: "20260825140000_p1_authorization_tables",
  membership_permissions: "20260825140000_p1_authorization_tables",
  authorization_audit: "20260825140000_p1_authorization_tables",
  role_templates: "20260826090000_p1b_role_templates_split",
  role_template_permissions: "20260826090000_p1b_role_templates_split"
} as const;

const LOCKED_TABLE_NAMES = Object.keys(LOCKED_TABLES) as Array<
  keyof typeof LOCKED_TABLES
>;

function migrationSql(name: string) {
  return readFileSync(
    join(projectRoot, "prisma", "migrations", name, "migration.sql"),
    "utf8"
  );
}

const P1_MIGRATION = join(
  projectRoot,
  "prisma",
  "migrations",
  "20260825140000_p1_authorization_tables",
  "migration.sql"
);

const P1B_MIGRATION = join(
  projectRoot,
  "prisma",
  "migrations",
  "20260826090000_p1b_role_templates_split",
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
        if ((LOCKED_TABLE_NAMES as readonly string[]).includes(match[1])) {
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

    for (const table of LOCKED_TABLE_NAMES) {
      expect(looped, `${table} must not be in the tenant loop`).not.toContain(
        table
      );
    }
  });

  it("enables RLS and revokes from anon and authenticated on all eight", () => {
    for (const table of LOCKED_TABLE_NAMES) {
      const sql = migrationSql(LOCKED_TABLES[table]);

      expect(sql, `${table}: ENABLE ROW LEVEL SECURITY`).toMatch(
        new RegExp(
          `ALTER\\s+TABLE\\s+"?${table}"?\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`,
          "i"
        )
      );
      expect(sql, `${table}: REVOKE ALL`).toMatch(
        new RegExp(
          `REVOKE\\s+ALL\\s+ON\\s+TABLE\\s+public\\.${table}\\s+FROM\\s+anon,\\s*authenticated`,
          "i"
        )
      );
    }
  });
});

describe("objects invisible to Prisma", () => {
  // CHECK constraints do not appear in schema.prisma, so a diff-based tool
  // would propose dropping them. This assertion is what makes that a failing
  // build rather than a silent regression.
  //
  // P1 had two more of these - a NULLS NOT DISTINCT index and a BEFORE trigger.
  // P1B removed both by making roles.organization_id NOT NULL; see the
  // describe block below.
  const p1 = () => readFileSync(P1_MIGRATION, "utf8");

  it("constrains membership_permissions.effect", () => {
    expect(p1()).toMatch(/CHECK\s*\(\s*"effect"\s+IN\s*\(\s*'GRANT',\s*'DENY'\s*\)\s*\)/i);
  });

  it("adds the composite FK target on organization_memberships", () => {
    expect(p1()).toMatch(
      /ADD\s+CONSTRAINT\s+"organization_memberships_id_organization_id_key"\s+UNIQUE\s*\(\s*"id",\s*"organization_id"\s*\)/i
    );
  });
});

describe("P1B: templates split out of roles", () => {
  /**
   * The point of P1B: one nullable discriminator (roles.organization_id) had
   * forced three separate workarounds. These assertions pin the fact that all
   * three are gone and cannot creep back, because each was individually
   * reasonable and would be re-introduced by anyone re-solving the same problem.
   */
  const p1b = () => readFileSync(P1B_MIGRATION, "utf8");

  /**
   * Statements only. These migrations explain themselves at length, and the
   * prose necessarily names the very clauses the negative assertions below are
   * checking are gone - so matching against the raw file would fail on its own
   * documentation.
   */
  const p1bStatements = () => p1b().replace(/--[^\n]*/g, "");

  it("makes roles.organization_id NOT NULL", () => {
    expect(p1b()).toMatch(
      /ALTER\s+TABLE\s+"roles"\s+ALTER\s+COLUMN\s+"organization_id"\s+SET\s+NOT\s+NULL/i
    );
  });

  it("replaces the NULLS NOT DISTINCT index with a plain unique", () => {
    const sql = p1b();

    expect(sql).toMatch(/DROP\s+INDEX\s+"roles_organization_id_key_key"/i);
    expect(sql).toMatch(
      /CREATE\s+UNIQUE\s+INDEX\s+"roles_organization_id_key_key"\s+ON\s+"roles"\s*\(\s*"organization_id",\s*"key"\s*\)\s*;/i
    );
    // The clause has nothing left to do once the column is NOT NULL, and
    // keeping it would leave the database stricter than schema.prisma says for
    // no reason at all. `[^;]*` keeps the match inside one statement.
    expect(p1bStatements()).not.toMatch(
      /CREATE\s+UNIQUE\s+INDEX[^;]*NULLS\s+NOT\s+DISTINCT/i
    );
  });

  it("replaces the tenant-match trigger with a real composite foreign key", () => {
    const sql = p1b();

    expect(sql).toMatch(
      /DROP\s+TRIGGER\s+"membership_roles_assert_tenant"\s+ON\s+"membership_roles"/i
    );
    expect(sql).toMatch(
      /DROP\s+FUNCTION\s+public\.assert_membership_role_tenant/i
    );
    expect(sql).toMatch(
      /ADD\s+CONSTRAINT\s+"membership_roles_role_id_organization_id_fkey"[\s\S]*?FOREIGN\s+KEY\s*\(\s*"role_id",\s*"organization_id"\s*\)[\s\S]*?REFERENCES\s+"roles"\s*\(\s*"id",\s*"organization_id"\s*\)/i
    );
    expect(sql).toMatch(
      /ADD\s+CONSTRAINT\s+"roles_id_organization_id_key"\s+UNIQUE\s*\(\s*"id",\s*"organization_id"\s*\)/i
    );
  });

  it("carries the six templates and their 86 rows across rather than dropping them", () => {
    const sql = p1b();

    // Self-sufficient on purpose: the database must be correct the moment the
    // migration applies, whether or not anyone remembers to re-run the seed.
    expect(sql).toMatch(/INSERT\s+INTO\s+"role_templates"[\s\S]*?SELECT[\s\S]*?FROM\s+"roles"/i);
    expect(sql).toMatch(
      /INSERT\s+INTO\s+"role_template_permissions"[\s\S]*?SELECT[\s\S]*?FROM\s+"role_permissions"/i
    );
    expect(sql).toMatch(/DELETE\s+FROM\s+"roles"\s+WHERE\s+"organization_id"\s+IS\s+NULL/i);
  });

  it("declares roles.organizationId as required in the Prisma schema", () => {
    const schema = readFileSync(join(projectRoot, "prisma", "schema.prisma"), "utf8");
    const roleModel = schema.match(/\nmodel Role \{([\s\S]*?)\n\}/);

    expect(roleModel).not.toBeNull();
    // `String?` here would put the nullable discriminator straight back.
    expect(roleModel![1]).toMatch(/organizationId\s+String\s+@map\("organization_id"\)/);
    expect(roleModel![1]).not.toMatch(/organizationId\s+String\?/);
    expect(roleModel![1]).toMatch(/@@unique\(\[id, organizationId\]\)/);
  });
});

describe("P1 stays inert", () => {
  it("has no reader or writer in app, features or lib", () => {
    // The phase's defining property. lib/auth/catalog.ts is the seed's source
    // data, not a consumer: it names no Prisma model.
    const roots = ["app", "features", "lib"];
    const models = [
      "role",
      "roleTemplate",
      "roleTemplatePermission",
      "permission",
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
