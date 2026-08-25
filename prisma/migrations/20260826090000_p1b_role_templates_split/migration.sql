-- P1B: move the system role templates out of `roles`.
--
-- WHY THIS EXISTS
-- ---------------
-- P1 stored the six system templates in `roles` with `organization_id IS NULL`,
-- using one nullable column to mean "this row is not tenant data". That single
-- decision cost three separate workarounds, each documented in the P1 migration:
--
--   1. NULLS NOT DISTINCT on roles(organization_id, key) - a clause Prisma
--      cannot express, so the database was deliberately stricter than
--      schema.prisma said, and any `migrate diff` would propose dropping it.
--   2. A BEFORE trigger on membership_roles standing in for a composite foreign
--      key, because roles.organization_id was nullable and MATCH SIMPLE
--      satisfies any FK with a NULL component vacuously - silently skipping
--      exactly the rows it most needed to cover.
--   3. An upsert footgun: Prisma compiles `organizationId: null` inside a
--      compound unique into `organization_id = NULL`, which matches nothing, so
--      writers had to remember to use findFirst instead.
--
-- Copy-on-create means no membership ever points at a template, so the
-- templates are pure seed data. Moving them to their own table makes
-- roles.organization_id NOT NULL, and all three workarounds disappear at once:
-- the trigger becomes a real composite key, the index becomes a plain unique,
-- and the Prisma footgun becomes unreachable.
--
-- TIMING
-- ------
-- This is done now because P1 left the tables inert: 6 template rows, 0 tenant
-- roles, 0 membership rows. P2 is the phase that fills `roles` with per-tenant
-- clones. After that this stops being a table rename and becomes a data
-- migration over live tenant data.
--
-- Hand-written, like every migration here. `prisma migrate dev` is banned: the
-- live user_access still carries two columns the schema dropped, so migrate dev
-- folds destructive DROP COLUMNs into whatever else it generates. Apply with
-- `npm run db:deploy`, and run `prisma migrate status` first.
--
-- SHARED DATABASE. Every branch's dev server points at this one Supabase
-- project. Merge to main the same day and tell branch owners to rebase.
--
-- One object below remains invisible to Prisma and must not be lost to a
-- `migrate diff`: the CHECK on membership_permissions.effect, created in P1 and
-- untouched here. The other two are removed by this file, on purpose.

-- Fail fast rather than queue behind a long read and block every branch.
--
-- Plain SET, not SET LOCAL: SET LOCAL outside a transaction is a no-op that only
-- emits a WARNING, so if Prisma ever stops wrapping migration files the timeout
-- would silently stop applying.
SET lock_timeout = '3s';

-- ---------------------------------------------------------------------------
-- 1. The templates get their own table.
--
--    No organization_id, so no nullable discriminator, so a plain unique index
--    on `key` is the whole story. `is_built_in` does not come along: every row
--    in this table is built in by definition. The column stays on `roles`,
--    where P4 uses it to refuse renaming or deleting a tenant's cloned
--    built-ins.
-- ---------------------------------------------------------------------------

CREATE TABLE "role_templates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "rank" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "role_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "role_templates_key_key" ON "role_templates" ("key");

CREATE TABLE "role_template_permissions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "role_template_id" UUID NOT NULL,
  "permission_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "role_template_permissions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "role_template_permissions"
  ADD CONSTRAINT "role_template_permissions_role_template_id_fkey"
  FOREIGN KEY ("role_template_id") REFERENCES "role_templates"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "role_template_permissions"
  ADD CONSTRAINT "role_template_permissions_permission_id_fkey"
  FOREIGN KEY ("permission_id") REFERENCES "permissions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "role_template_permissions_role_template_id_permission_id_key"
  ON "role_template_permissions" ("role_template_id", "permission_id");
CREATE INDEX "role_template_permissions_role_template_id_idx"
  ON "role_template_permissions" ("role_template_id");

-- ---------------------------------------------------------------------------
-- 2. Move the rows, preserving ids.
--
--    Done here rather than left to the seed so the migration is self-sufficient:
--    the database is correct the moment it applies, whether or not anyone
--    remembers to run `npm run db:seed-authorization` afterwards. The seed stays
--    idempotent and converges on the same rows.
-- ---------------------------------------------------------------------------

INSERT INTO "role_templates" ("id", "key", "name", "description", "rank", "created_at", "updated_at")
SELECT "id", "key", "name", "description", "rank", "created_at", "updated_at"
  FROM "roles"
 WHERE "organization_id" IS NULL;

INSERT INTO "role_template_permissions" ("id", "role_template_id", "permission_id", "created_at")
SELECT role_permission."id",
       role_permission."role_id",
       role_permission."permission_id",
       role_permission."created_at"
  FROM "role_permissions" AS role_permission
  JOIN "roles" AS role_row ON role_row."id" = role_permission."role_id"
 WHERE role_row."organization_id" IS NULL;

-- Cascades to role_permissions. Everything above has already been copied.
DELETE FROM "roles" WHERE "organization_id" IS NULL;

-- ---------------------------------------------------------------------------
-- 3. The point of the whole migration.
--
--    If any NULL-org row somehow survived step 2, this ALTER fails and the
--    migration rolls back rather than half-applying. That is the correct
--    outcome: it can only happen if `roles` acquired rows this file does not
--    know about, which is exactly when a human should look.
-- ---------------------------------------------------------------------------

ALTER TABLE "roles" ALTER COLUMN "organization_id" SET NOT NULL;

-- The NULLS NOT DISTINCT clause has nothing left to do: there are no NULLs in
-- the column any more. Same index name, so schema.prisma's @@unique still lines
-- up, but now the file and the database say the same thing.
DROP INDEX "roles_organization_id_key_key";
CREATE UNIQUE INDEX "roles_organization_id_key_key"
  ON "roles" ("organization_id", "key");

-- The composite FK target. `id` is already the primary key, so this adds no
-- uniqueness anyone needed - it exists so the key below can carry
-- organization_id through.
ALTER TABLE "roles"
  ADD CONSTRAINT "roles_id_organization_id_key"
  UNIQUE ("id", "organization_id");

-- ---------------------------------------------------------------------------
-- 4. The trigger becomes a foreign key.
--
--    Both columns are NOT NULL on both sides now, so MATCH SIMPLE has no NULL
--    component to satisfy vacuously and the key actually constrains every row.
--    This is strictly stronger than the trigger it replaces: a foreign key is
--    checked by the storage engine on every path, cannot be disabled by a
--    session that forgot, and cannot be dropped by accident without the schema
--    noticing.
-- ---------------------------------------------------------------------------

ALTER TABLE "membership_roles"
  DROP CONSTRAINT "membership_roles_role_id_fkey";

-- RESTRICT, not CASCADE: deleting a role people still hold must fail loudly.
-- P4 returns 409 and asks the owner to reassign first.
ALTER TABLE "membership_roles"
  ADD CONSTRAINT "membership_roles_role_id_organization_id_fkey"
  FOREIGN KEY ("role_id", "organization_id")
  REFERENCES "roles"("id", "organization_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

DROP TRIGGER "membership_roles_assert_tenant" ON "membership_roles";
DROP FUNCTION public.assert_membership_role_tenant();

-- ---------------------------------------------------------------------------
-- 5. Row-level security on the two new tables.
--
--    Same treatment as the six P1 tables and payment_provider_webhook_events:
--    RLS enabled, every privilege revoked from anon and authenticated, and NO
--    POLICY AT ALL. Neither table is added to the tenant loop in
--    prisma/supabase-rls.sql - they have no organization_id to filter on, and
--    nothing in a browser has any business reading the permission matrix.
--
--    Today this documents intent rather than enforcing it: `authenticated`
--    holds no privilege on any table in public and there is no default ACL for
--    the schema, so these tables are born unreachable. The REVOKE states the
--    intent for the day someone runs a blanket GRANT.
-- ---------------------------------------------------------------------------

ALTER TABLE "role_templates" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.role_templates FROM anon, authenticated;

ALTER TABLE "role_template_permissions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.role_template_permissions FROM anon, authenticated;
