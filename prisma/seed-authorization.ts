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
 * This script creates ZERO org-scoped rows. Only the six templates, in
 * `role_templates`. Per-tenant clones land in `roles` and are P2's job - see the
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
    // A plain upsert on a plain unique. P1 could not do this: templates lived in
    // `roles` behind a nullable organization_id, and Prisma compiles
    // `where: { organizationId_key: { organizationId: null, key } }` into
    // `organization_id = NULL`, which matches nothing - so the upsert silently
    // attempted an INSERT every run. P1B moved templates to their own table and
    // the workaround went with it.
    await prisma.roleTemplate.upsert({
      where: { key: template.key },
      create: {
        key: template.key,
        name: template.name,
        description: template.description,
        rank: template.rank
      },
      update: {
        name: template.name,
        description: template.description,
        rank: template.rank
      }
    });
  }

  return prisma.roleTemplate.count();
}

async function seedRoleTemplatePermissions() {
  const permissionIdByKey = new Map(
    (await prisma.permission.findMany({ select: { id: true, key: true } })).map(
      (permission) => [permission.key, permission.id]
    )
  );

  let written = 0;

  for (const template of roleTemplateCatalog) {
    const roleTemplate = await prisma.roleTemplate.findUnique({
      where: { key: template.key },
      select: { id: true }
    });

    if (!roleTemplate) {
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
    await prisma.roleTemplatePermission.deleteMany({
      where: {
        roleTemplateId: roleTemplate.id,
        permissionId: { notIn: desiredIds }
      }
    });

    await prisma.roleTemplatePermission.createMany({
      data: desiredIds.map((permissionId) => ({
        roleTemplateId: roleTemplate.id,
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
  const roleTemplates = await seedRoleTemplates();
  const templatePermissions = await seedRoleTemplatePermissions();

  const actualTemplatePermissions = await prisma.roleTemplatePermission.count();

  console.log(
    `Authorization seed complete: ${permissions} permissions, ${roleTemplates} system role templates, ${templatePermissions} template permissions (${actualTemplatePermissions} rows total).`
  );

  if (permissions !== 23) {
    throw new Error(`Expected 23 permissions, found ${permissions}.`);
  }

  if (roleTemplates !== 6) {
    throw new Error(`Expected 6 system role templates, found ${roleTemplates}.`);
  }

  if (templatePermissions !== 86) {
    throw new Error(
      `Expected 86 derived template permissions, found ${templatePermissions}.`
    );
  }

  // P1's defining property, asserted rather than assumed. `roles` is included
  // now that it holds only tenant data: the first row in it means P2 has begun
  // cloning, and the phase is no longer inert.
  const [tenantRoles, rolePermissions, membershipRoles, membershipPermissions, audits] =
    await Promise.all([
      prisma.role.count(),
      prisma.rolePermission.count(),
      prisma.membershipRole.count(),
      prisma.membershipPermission.count(),
      prisma.authorizationAudit.count()
    ]);

  if (
    tenantRoles ||
    rolePermissions ||
    membershipRoles ||
    membershipPermissions ||
    audits
  ) {
    throw new Error(
      `P1 must leave the tenant tables empty, found ${tenantRoles} roles, ${rolePermissions} role permissions, ${membershipRoles} membership roles, ${membershipPermissions} membership permissions, ${audits} audit rows.`
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
