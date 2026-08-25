/**
 * The authorization seed: the 62-key catalog, and the five starter roles for
 * every organization.
 *
 * Run with `npm run db:seed-authorization`, and run it IMMEDIATELY AFTER the
 * RBAC migration. Between the two, every principal holds nothing and every
 * guarded route 403s - the correct failure, but not a state to leave a database
 * in.
 *
 * WHY A SCRIPT, AND NOT THE TWO ALTERNATIVES
 * ------------------------------------------
 * Not a boot-time upsert: that turns every serverless cold start into a write
 * against shared authorization data.
 *
 * Not SQL literals baked into the migration: that is a second copy of the role
 * matrix, free to drift from lib/authz/starter-roles.ts. The rows are DERIVED
 * here, and tests/unit/authz-catalog.test.ts asserts the derivation still agrees
 * with the catalog, per role and by exact count.
 *
 * IDEMPOTENT, WITH ONE DELIBERATE ASYMMETRY
 * -----------------------------------------
 * The CATALOG converges: a re-run rewrites every permission row's label,
 * description, group and sort order to match the file. Those are presentation,
 * and the file is the source of truth for them.
 *
 * A ROLE'S GRANTS DO NOT. A starter role that already exists is left exactly as
 * the tenant left it. Re-running must never re-grant a key an owner deliberately
 * unticked, and must never hand an existing role a key added to the catalog
 * after they last looked - both would be a privilege change delivered by a
 * deploy rather than by a person, and therefore a grant with no audit row behind
 * it.
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { existsSync, readFileSync } from "node:fs";

import {
  permissionCatalog,
  permissionKeys,
  sortOrderOf
} from "../lib/authz/catalog";
import {
  DEFAULT_MEMBERSHIP_ROLE_KEY,
  starterRoles,
  totalStarterRolePermissionRows
} from "../lib/authz/starter-roles";
import {
  assignRole,
  ensureStarterRoles,
  permissionIdsByKey
} from "../lib/authz/provision";

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

/**
 * What the dropped `organization_memberships.role` strings become.
 *
 * This map is the ONLY place a legacy role name appears, it is read exactly once
 * per database, and the table it reads from is dropped at the end of this
 * script. It is not a compatibility layer - INV-1 would not survive one.
 */
const LEGACY_ROLE_TO_STARTER: Record<string, string> = {
  owner: "owner",
  superadmin: "owner",
  admin: "administrator",
  administrator: "administrator",
  manager: "event-manager",
  eventmanager: "event-manager",
  kitchen: "kitchen-staff",
  kitchenstaff: "kitchen-staff",
  viewer: "viewer",
  member: "viewer"
};

/**
 * `billing` has no equivalent in the starter five, and that is deliberate rather
 * than an oversight: a bookkeeper holding `invoice.*`, `payment.record`,
 * `report.read` and nothing else is the role the design leaves out on purpose,
 * as the test of whether composing one needs any code. It does not - it needs a
 * role editor and eleven checkboxes.
 *
 * Mapping them to Viewer rather than guessing keeps the demotion visible. The
 * summary below names every affected membership so an owner knows exactly who to
 * re-grant.
 */
const LEGACY_ROLE_WITHOUT_EQUIVALENT = "billing";

function starterRoleKeyFor(legacyRole: string): {
  key: string;
  demoted: boolean;
} {
  const normalized = legacyRole.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

  if (normalized === LEGACY_ROLE_WITHOUT_EQUIVALENT) {
    return { key: "viewer", demoted: true };
  }

  return {
    key: LEGACY_ROLE_TO_STARTER[normalized] ?? DEFAULT_MEMBERSHIP_ROLE_KEY,
    demoted: false
  };
}

async function seedCatalog() {
  for (const entry of permissionCatalog) {
    const row = {
      label: entry.label,
      description: entry.description,
      groupLabel: entry.group,
      isDangerous: entry.isDangerous,
      sortOrder: sortOrderOf(entry.key)
    };

    await prisma.permission.upsert({
      where: { key: entry.key },
      create: { key: entry.key, ...row },
      update: row
    });
  }

  // A key that left the catalog must leave the table too, or a role can go on
  // granting something no call site enforces and no editor can untick.
  const removed = await prisma.permission.deleteMany({
    where: { key: { notIn: [...permissionKeys] } }
  });

  if (removed.count > 0) {
    console.log(`  removed ${removed.count} permission(s) no longer in the catalog`);
  }

  return prisma.permission.count();
}

type BackfillRow = {
  membership_id: string;
  organization_id: string;
  legacy_role: string;
  allowed_hall_ids: string[];
};

/**
 * Read what the RBAC migration captured from the columns it dropped.
 *
 * Absent on a database that was migrated and seeded already, or on a fresh one -
 * both are ordinary, so this returns an empty list rather than failing.
 */
async function readLegacyBackfill(): Promise<BackfillRow[]> {
  const [{ exists }] = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT to_regclass('public._authz_legacy_backfill') IS NOT NULL AS exists
  `;

  if (!exists) return [];

  return prisma.$queryRaw<BackfillRow[]>`
    SELECT "membership_id", "organization_id", "legacy_role", "allowed_hall_ids"
      FROM "_authz_legacy_backfill"
  `;
}

async function seedOrganizations() {
  const organizations = await prisma.organization.findMany({
    select: { id: true, name: true }
  });
  const catalog = await permissionIdsByKey(prisma as unknown as Prisma.TransactionClient);

  if (catalog.size !== permissionKeys.length) {
    throw new Error(
      `Catalog table holds ${catalog.size} of ${permissionKeys.length} keys. Seed the catalog first.`
    );
  }

  let rolesCreated = 0;

  for (const organization of organizations) {
    const before = await prisma.role.count({
      where: { organizationId: organization.id }
    });

    await prisma.$transaction(async (transaction) => {
      await ensureStarterRoles(transaction, organization.id, catalog);
    });

    rolesCreated +=
      (await prisma.role.count({ where: { organizationId: organization.id } })) -
      before;
  }

  return { organizations: organizations.length, rolesCreated };
}

async function backfillAssignments() {
  const rows = await readLegacyBackfill();

  if (rows.length === 0) {
    return { assigned: 0, scoped: 0, demoted: [] as string[] };
  }

  const memberships = await prisma.organizationMembership.findMany({
    where: { id: { in: rows.map((row) => row.membership_id) } },
    select: {
      id: true,
      principalId: true,
      organizationId: true,
      user: { select: { name: true, email: true } }
    }
  });
  const membershipById = new Map(memberships.map((row) => [row.id, row]));

  const roleIdsByOrganization = new Map<string, Map<string, string>>();
  let assigned = 0;
  let scoped = 0;
  const demoted: string[] = [];

  for (const row of rows) {
    const membership = membershipById.get(row.membership_id);
    if (!membership) continue;

    // Only ever the first assignment. A principal that already holds something
    // has been administered since the migration, and the backfill must not
    // reach back over that.
    const held = await prisma.principalRole.count({
      where: { principalId: membership.principalId }
    });
    if (held > 0) continue;

    let roleIds = roleIdsByOrganization.get(membership.organizationId);
    if (!roleIds) {
      roleIds = new Map(
        (
          await prisma.role.findMany({
            where: { organizationId: membership.organizationId, isSystem: true },
            select: { id: true, key: true }
          })
        ).map((role) => [role.key, role.id] as const)
      );
      roleIdsByOrganization.set(membership.organizationId, roleIds);
    }

    const mapped = starterRoleKeyFor(row.legacy_role);
    const roleId = roleIds.get(mapped.key);
    if (!roleId) continue;

    if (mapped.demoted) {
      demoted.push(`${membership.user.name} <${membership.user.email}>`);
    }

    // `allowed_hall_ids` was the product's only scoping mechanism, and an empty
    // list meant "every hall". Translating an empty list to an org-scoped
    // assignment preserves that exactly; translating it to zero hall-scoped rows
    // would silently deny everything instead.
    const hallIds = (row.allowed_hall_ids ?? []).filter(Boolean);

    await prisma.$transaction(async (transaction) => {
      if (hallIds.length === 0) {
        await assignRole(transaction, {
          principalId: membership.principalId,
          organizationId: membership.organizationId,
          roleId
        });
        return;
      }

      for (const hallId of hallIds) {
        await assignRole(transaction, {
          principalId: membership.principalId,
          organizationId: membership.organizationId,
          roleId,
          scopeType: "hall",
          scopeId: hallId
        });
      }
    });

    assigned += 1;
    scoped += hallIds.length > 0 ? 1 : 0;
  }

  return { assigned, scoped, demoted };
}

async function main() {
  console.log("Seeding the permission catalog...");
  const permissions = await seedCatalog();

  if (permissions !== permissionKeys.length) {
    throw new Error(
      `Expected ${permissionKeys.length} permissions, found ${permissions}.`
    );
  }

  console.log("Materializing starter roles per organization...");
  const { organizations, rolesCreated } = await seedOrganizations();

  console.log("Translating legacy memberships into assignments...");
  const backfill = await backfillAssignments();

  const [roleCount, rolePermissionCount, assignmentCount] = await Promise.all([
    prisma.role.count(),
    prisma.rolePermission.count(),
    prisma.principalRole.count()
  ]);

  console.log(
    [
      "",
      "Authorization seed complete.",
      `  ${permissions} permission keys`,
      `  ${organizations} organizations, ${rolesCreated} starter roles created (${roleCount} roles total)`,
      `  ${rolePermissionCount} role permission rows`,
      `  ${backfill.assigned} memberships assigned a role (${backfill.scoped} of them hall-scoped)`,
      `  ${assignmentCount} assignments total`
    ].join("\n")
  );

  if (backfill.demoted.length > 0) {
    console.warn(
      [
        "",
        `WARNING: ${backfill.demoted.length} member(s) held the legacy "billing" role, which has no`,
        "starter equivalent, and were assigned Viewer instead:",
        ...backfill.demoted.map((who) => `  - ${who}`),
        "",
        "Compose a Bookkeeper role for them in Settings -> Access. It is:",
        "  invoice.read, invoice.create, invoice.update, invoice.void,",
        "  payment.record, payment.refund, payment.notify, report.read,",
        "  client.read, file.read, event.read",
        ""
      ].join("\n")
    );
  }

  // The scratch table has done its work. Leaving it behind means the next run
  // re-reads role names that no longer describe anything.
  await prisma.$executeRawUnsafe(
    'DROP TABLE IF EXISTS "_authz_legacy_backfill"'
  );

  const expectedPerOrganization = totalStarterRolePermissionRows();
  console.log(
    `A fully seeded organization holds ${starterRoles.length} starter roles and ${expectedPerOrganization} role permission rows.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
