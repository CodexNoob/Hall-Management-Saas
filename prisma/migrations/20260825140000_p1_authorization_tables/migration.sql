-- P1: introduce the authorization tables.
--
-- Six tables, the 23-key permission catalog, and organizations.permissions_epoch.
-- Nothing in app/, features/ or lib/ reads or writes any of it. That is the
-- phase's defining property: this migration cannot change any authorization
-- decision, because no code path consults the rows it creates. Enforcement
-- still runs entirely through the 23 boolean columns on user_access until P3
-- swaps the resolver behind AUTHZ_RESOLVER.
--
-- Hand-written, like every migration in this repo. `prisma migrate dev` is
-- banned here: the live user_access table still carries two columns the schema
-- dropped, so migrate dev folds destructive DROP COLUMNs into whatever else it
-- generates. Apply with `npm run db:deploy`, and run `prisma migrate status`
-- first - anything else pending belongs to another branch.
--
-- SHARED DATABASE. Every branch's dev server points at this one Supabase
-- project. The moment this lands in _prisma_migrations, any branch whose folder
-- lacks it looks drifted. Merge to main the same day and tell branch owners to
-- rebase. `migrate deploy` and `migrate status` stay safe on a stale branch.
--
-- Three objects below are invisible to Prisma and would be proposed for removal
-- by any diff-based tool: the NULLS NOT DISTINCT clause on the roles unique
-- index, the tenant-match trigger on membership_roles, and the CHECK on
-- membership_permissions.effect. Never generate migrations for these tables
-- with `migrate diff`.

-- DDL below takes ACCESS EXCLUSIVE on organizations and organization_memberships,
-- on the database every branch's dev server uses. Fail fast rather than queue
-- behind a long read and block everyone.
--
-- Plain SET, not SET LOCAL: SET LOCAL outside a transaction is a no-op that
-- only emits a WARNING, so if Prisma ever stops wrapping migration files the
-- timeout would silently stop applying. Plain SET is correct either way - it
-- rolls back with the transaction if there is one, and otherwise lasts for the
-- migration connection, which is exactly its useful lifetime.
SET lock_timeout = '3s';

-- ---------------------------------------------------------------------------
-- 1. Epoch column.
--    P3 makes this part of the resolver's cache key, so an edit invalidates
--    instantly with no TTL. P1 only creates it; nothing bumps it yet.
-- ---------------------------------------------------------------------------

ALTER TABLE "organizations"
  ADD COLUMN "permissions_epoch" INTEGER NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- 2. Composite FK target on memberships.
--    `id` is already the primary key, so this adds no uniqueness anyone needed.
--    It exists so the two membership-scoped tables below can carry a COMPOSITE
--    foreign key onto (id, organization_id), making a grant row that names
--    organization X while its membership lives in organization Y structurally
--    impossible. Same defect class as C2, closed by the key rather than by a
--    code path someone can forget to write.
-- ---------------------------------------------------------------------------

ALTER TABLE "organization_memberships"
  ADD CONSTRAINT "organization_memberships_id_organization_id_key"
  UNIQUE ("id", "organization_id");

-- ---------------------------------------------------------------------------
-- 3. Permission catalog. Global, not per-tenant: tenants compose roles out of
--    these keys, they do not invent keys.
-- ---------------------------------------------------------------------------

CREATE TABLE "permissions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "key" TEXT NOT NULL,
  "legacy_column" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "group_label" TEXT NOT NULL,
  "is_dangerous" BOOLEAN NOT NULL DEFAULT false,
  "sort_order" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "permissions_key_key" ON "permissions" ("key");
CREATE UNIQUE INDEX "permissions_legacy_column_key" ON "permissions" ("legacy_column");
CREATE INDEX "permissions_sort_order_idx" ON "permissions" ("sort_order");

-- ---------------------------------------------------------------------------
-- 4. Roles. organization_id IS NULL marks one of the six system templates.
-- ---------------------------------------------------------------------------

CREATE TABLE "roles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "rank" INTEGER NOT NULL,
  "is_built_in" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "roles"
  ADD CONSTRAINT "roles_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- INVISIBLE TO PRISMA. Prisma emits a plain unique index for @@unique, and
-- standard SQL treats every NULL as distinct - so without NULLS NOT DISTINCT
-- two system templates could both be keyed 'owner' and the index would permit
-- it. Postgres 15+; this project runs 17.6. The index NAME matches what Prisma
-- expects for @@unique([organizationId, key]) so the schema does not read as
-- drifted, but the database is deliberately stricter than schema.prisma says.
--
-- Consequence for any future writer: Prisma compiles
--   where: { organizationId_key: { organizationId: null, key } }
-- into `organization_id = NULL`, which matches nothing - so an upsert through
-- the compound unique silently attempts an INSERT and is then rejected here
-- with a confusing unique violation. Look system templates up with findFirst.
CREATE UNIQUE INDEX "roles_organization_id_key_key"
  ON "roles" ("organization_id", "key") NULLS NOT DISTINCT;

CREATE INDEX "roles_organization_id_idx" ON "roles" ("organization_id");

-- ---------------------------------------------------------------------------
-- 5. Which permissions a role grants. 86 rows for the six system templates,
--    derived by the seed from the compile-time matrix rather than restated as
--    SQL literals here - a second copy of the matrix is free to drift from the
--    first, which is the exact failure this phase exists to prevent.
-- ---------------------------------------------------------------------------

CREATE TABLE "role_permissions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "role_id" UUID NOT NULL,
  "permission_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "role_permissions"
  ADD CONSTRAINT "role_permissions_role_id_fkey"
  FOREIGN KEY ("role_id") REFERENCES "roles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "role_permissions"
  ADD CONSTRAINT "role_permissions_permission_id_fkey"
  FOREIGN KEY ("permission_id") REFERENCES "permissions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key"
  ON "role_permissions" ("role_id", "permission_id");
CREATE INDEX "role_permissions_role_id_idx" ON "role_permissions" ("role_id");

-- ---------------------------------------------------------------------------
-- 6. Which roles a membership holds.
-- ---------------------------------------------------------------------------

CREATE TABLE "membership_roles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "membership_id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "role_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "membership_roles_pkey" PRIMARY KEY ("id")
);

-- The composite FK. This is the structural half of the tenant guarantee.
ALTER TABLE "membership_roles"
  ADD CONSTRAINT "membership_roles_membership_id_organization_id_fkey"
  FOREIGN KEY ("membership_id", "organization_id")
  REFERENCES "organization_memberships"("id", "organization_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "membership_roles"
  ADD CONSTRAINT "membership_roles_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- RESTRICT, not CASCADE: deleting a role that people still hold must fail
-- loudly. P4 returns 409 and asks the owner to reassign first.
ALTER TABLE "membership_roles"
  ADD CONSTRAINT "membership_roles_role_id_fkey"
  FOREIGN KEY ("role_id") REFERENCES "roles"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "membership_roles_membership_id_role_id_key"
  ON "membership_roles" ("membership_id", "role_id");
CREATE INDEX "membership_roles_organization_id_idx" ON "membership_roles" ("organization_id");
CREATE INDEX "membership_roles_role_id_idx" ON "membership_roles" ("role_id");

-- ---------------------------------------------------------------------------
-- 7. Per-user overrides. GRANT adds what the roles do not carry; DENY removes
--    what they do. DENY wins.
-- ---------------------------------------------------------------------------

CREATE TABLE "membership_permissions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "membership_id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "permission_id" UUID NOT NULL,
  "effect" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "membership_permissions_pkey" PRIMARY KEY ("id"),
  -- INVISIBLE TO PRISMA.
  CONSTRAINT "membership_permissions_effect_check"
    CHECK ("effect" IN ('GRANT', 'DENY'))
);

ALTER TABLE "membership_permissions"
  ADD CONSTRAINT "membership_permissions_membership_id_organization_id_fkey"
  FOREIGN KEY ("membership_id", "organization_id")
  REFERENCES "organization_memberships"("id", "organization_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "membership_permissions"
  ADD CONSTRAINT "membership_permissions_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "membership_permissions"
  ADD CONSTRAINT "membership_permissions_permission_id_fkey"
  FOREIGN KEY ("permission_id") REFERENCES "permissions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "membership_permissions_membership_id_permission_id_key"
  ON "membership_permissions" ("membership_id", "permission_id");
CREATE INDEX "membership_permissions_organization_id_idx"
  ON "membership_permissions" ("organization_id");

-- ---------------------------------------------------------------------------
-- 8. Audit trail. P2 starts writing it.
--    actor_name / subject_name are snapshots for the same reason
--    activity_logs.user_name is: both FKs are SET NULL, so without the snapshot
--    a deleted user's audit entry stops naming anyone - which is exactly when
--    the entry matters most.
-- ---------------------------------------------------------------------------

CREATE TABLE "authorization_audit" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "actor_id" UUID,
  "actor_name" TEXT NOT NULL,
  "subject_id" UUID,
  "subject_name" TEXT,
  "action" TEXT NOT NULL,
  "detail" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "authorization_audit_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "authorization_audit"
  ADD CONSTRAINT "authorization_audit_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "authorization_audit"
  ADD CONSTRAINT "authorization_audit_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "authorization_audit"
  ADD CONSTRAINT "authorization_audit_subject_id_fkey"
  FOREIGN KEY ("subject_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "authorization_audit_organization_id_created_at_idx"
  ON "authorization_audit" ("organization_id", "created_at");
CREATE INDEX "authorization_audit_subject_id_idx"
  ON "authorization_audit" ("subject_id");

-- ---------------------------------------------------------------------------
-- 9. The tenant-match trigger.
--
--    A composite FK onto roles(id, organization_id) CANNOT express this.
--    roles.organization_id is nullable for system templates, and MATCH SIMPLE -
--    the default - satisfies any foreign key with a NULL component vacuously.
--    It would silently skip exactly the rows it most needs to cover. So the
--    invariant is a trigger, which holds regardless of which role connects and
--    regardless of whether the writing code path remembered to check.
--
--    INVISIBLE TO PRISMA.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.assert_membership_role_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  role_organization_id pg_catalog.uuid;
BEGIN
  SELECT role_row.organization_id
    INTO role_organization_id
    FROM public.roles AS role_row
   WHERE role_row.id = NEW.role_id;

  -- The role_id foreign key is enforced by an AFTER trigger, so at BEFORE time
  -- the row may not exist yet. Checking FOUND first also keeps the NULL below
  -- unambiguous: a system template and a missing role both read as NULL.
  IF NOT FOUND THEN
    RAISE EXCEPTION
      'membership_roles.role_id % does not exist', NEW.role_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- NULL means a system template, which every tenant may hold.
  IF role_organization_id IS NOT NULL
     AND role_organization_id <> NEW.organization_id THEN
    RAISE EXCEPTION
      'role % belongs to organization %, not %',
      NEW.role_id, role_organization_id, NEW.organization_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_membership_role_tenant() FROM PUBLIC;

CREATE TRIGGER "membership_roles_assert_tenant"
  BEFORE INSERT OR UPDATE ON "membership_roles"
  FOR EACH ROW EXECUTE FUNCTION public.assert_membership_role_tenant();

-- ---------------------------------------------------------------------------
-- 10. Row-level security.
--
--     All six tables get the payment_provider_webhook_events / newsletter_
--     subscribers treatment: RLS enabled, every privilege revoked from anon and
--     authenticated, and NO POLICY AT ALL. None of them is added to the tenant
--     loop in prisma/supabase-rls.sql.
--
--     This matters most for membership_permissions, so read the tenant policy
--     against it. Every row there means "this member holds this permission",
--     and the policy's WITH CHECK asks only `is_organization_member(
--     organization_id)` - whether the writer belongs to the organization. They
--     do. So any member could INSERT a row granting themselves any permission
--     in it: C1 reproduced verbatim on the one table whose entire purpose is
--     handing out privileges. FOR SELECT is not sufficient either; it would
--     expose every colleague's grant map.
--
--     Both membership tables DO carry organization_id, so they pass the
--     mechanical "does it have organization_id?" test the next maintainer will
--     apply to that array. The column is there for the composite foreign key,
--     not to opt in. tests/unit/authorization-catalog.test.ts is the control,
--     because a comment is not one.
--
--     Today this is documentation rather than enforcement: `authenticated`
--     holds no privilege on any table in public and there is no default ACL for
--     the schema, so these tables are born unreachable anyway. The REVOKE
--     states the intent for the day someone runs a blanket GRANT.
-- ---------------------------------------------------------------------------

ALTER TABLE "permissions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.permissions FROM anon, authenticated;

ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.roles FROM anon, authenticated;

ALTER TABLE "role_permissions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.role_permissions FROM anon, authenticated;

ALTER TABLE "membership_roles" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.membership_roles FROM anon, authenticated;

ALTER TABLE "membership_permissions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.membership_permissions FROM anon, authenticated;

ALTER TABLE "authorization_audit" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.authorization_audit FROM anon, authenticated;
