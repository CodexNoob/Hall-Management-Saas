/**
 * P1 authorization seed: the 23-key permission catalog and the six system role
 * templates, with the 86 role_permission rows derived from the compile-time
 * matrix.
 *
 * Run with `npm run db:seed-authorization`. Idempotent - re-running converges
 * rather than duplicating, so the rows stay re-derivable and the dotted keys
 * stay cheap to rename right up until P2 starts writing tenant-authored grants.
 *
 * WHY A SCRIPT, AND NOT THE TWO ALTERNATIVES
 * ------------------------------------------
 * Not a boot-time upsert: that turns every serverless cold start into a write
 * against shared authorization data.
 *
 * Not SQL literals baked into the migration: that is a second copy of the role
 * matrix, free to drift from lib/auth/permissions.ts, which is the exact
 * failure this phase exists to prevent. The rows are DERIVED here, and
 * tests/unit/authorization-catalog.test.ts asserts the derivation still agrees
 * with the matrix, per role and by exact count.
 *
 * This script creates ZERO org-scoped rows. Only the six templates, with
 * organization_id IS NULL. Per-tenant clones are P2's job - see the
 * copy-on-create decision - and no membership is wired to anything here.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { existsSync, readFileSync } from "node:fs";

import {
  permissionCatalog,
  permissionKeysForSystemRole,
  roleTemplateCatalog
} from "../lib/auth/catalog";

function loadEnvFile(path: string) {
  if (!existsSync(path)) {
    return;
  }

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([^#][^=]+)=(.*)$/);

    if (!match) {
      continue;
    }

    const name = match[1].trim();
    const value = match[2].trim().replace(/^"(.*)"$/, "$1");

    process.env[name] ??= value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

function getDatabaseUrl() {
  const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  return databaseUrl;
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: getDatabaseUrl() }),
  log: ["error"]
});

async function seedPermissions() {
  for (const entry of permissionCatalog) {
    await prisma.permission.upsert({
      where: { key: entry.key },
      create: {
        key: entry.key,
        legacyColumn: entry.legacyColumn,
        label: entry.label,
        description: entry.description,
        groupLabel: entry.group,
        isDangerous: entry.isDangerous,
        sortOrder: entry.sortOrder
      },
      update: {
        legacyColumn: entry.legacyColumn,
        label: entry.label,
        description: entry.description,
        groupLabel: entry.group,
        isDangerous: entry.isDangerous,
        sortOrder: entry.sortOrder
      }
    });
  }

  return prisma.permission.count();
}

async function seedRoleTemplates() {
  for (const template of roleTemplateCatalog) {
    // findFirst, NOT upsert through the compound unique. Prisma compiles
    // `where: { organizationId_key: { organizationId: null, key } }` into
    // `organization_id = NULL`, which matches nothing - so the upsert would
    // silently attempt an INSERT every run and the NULLS NOT DISTINCT index
    // would reject it with a confusing unique violation.
    const existing = await prisma.role.findFirst({
      where: { organizationId: null, key: template.key },
      select: { id: true }
    });

    if (existing) {
      await prisma.role.update({
        where: { id: existing.id },
        data: {
          name: template.name,
          description: template.description,
          rank: template.rank,
          isBuiltIn: true
        }
      });
      continue;
    }

    await prisma.role.create({
      data: {
        organizationId: null,
        key: template.key,
        name: template.name,
        description: template.description,
        rank: template.rank,
        isBuiltIn: true
      }
    });
  }

  return prisma.role.count({ where: { organizationId: null } });
}

async function seedRolePermissions() {
  const permissionIdByKey = new Map(
    (await prisma.permission.findMany({ select: { id: true, key: true } })).map(
      (permission) => [permission.key, permission.id]
    )
  );

  let written = 0;

  for (const template of roleTemplateCatalog) {
    const role = await prisma.role.findFirst({
      where: { organizationId: null, key: template.key },
      select: { id: true }
    });

    if (!role) {
      throw new Error(`System role template "${template.key}" is missing.`);
    }

    const desiredIds = permissionKeysForSystemRole(template.key).map((key) => {
      const id = permissionIdByKey.get(key);

      if (!id) {
        throw new Error(`Permission "${key}" is not in the catalog table.`);
      }

      return id;
    });

    // Converge rather than append: drop anything the matrix no longer grants,
    // then add what is missing. Re-running after a matrix edit is the intended
    // way to correct these rows.
    await prisma.rolePermission.deleteMany({
      where: { roleId: role.id, permissionId: { notIn: desiredIds } }
    });

    await prisma.rolePermission.createMany({
      data: desiredIds.map((permissionId) => ({
        roleId: role.id,
        permissionId
      })),
      skipDuplicates: true
    });

    written += desiredIds.length;
  }

  return written;
}

async function main() {
  const permissions = await seedPermissions();
  const roles = await seedRoleTemplates();
  const rolePermissions = await seedRolePermissions();

  const actualRolePermissions = await prisma.rolePermission.count();

  console.log(
    `Authorization seed complete: ${permissions} permissions, ${roles} system role templates, ${rolePermissions} role permissions (${actualRolePermissions} rows total).`
  );

  if (permissions !== 23) {
    throw new Error(`Expected 23 permissions, found ${permissions}.`);
  }

  if (roles !== 6) {
    throw new Error(`Expected 6 system role templates, found ${roles}.`);
  }

  if (rolePermissions !== 86) {
    throw new Error(
      `Expected 86 derived role permissions, found ${rolePermissions}.`
    );
  }

  // P1's defining property, asserted rather than assumed. If any of these is
  // non-zero, something already wired a membership to the new tables and the
  // phase is no longer inert.
  const [membershipRoles, membershipPermissions, audits] = await Promise.all([
    prisma.membershipRole.count(),
    prisma.membershipPermission.count(),
    prisma.authorizationAudit.count()
  ]);

  if (membershipRoles || membershipPermissions || audits) {
    throw new Error(
      `P1 must leave the membership tables empty, found ${membershipRoles} membership roles, ${membershipPermissions} membership permissions, ${audits} audit rows.`
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
