-- RBAC: roles as rows.
--
-- WHAT THIS REPLACES
-- ------------------
-- Three things go at once, because keeping any of them means keeping two
-- privilege paths and the design turns on there being exactly one:
--
--   * `user_access` - 23 boolean columns per member, plus `allowed_hall_ids`.
--   * `organization_memberships.role` and `users.role` - role names as strings
--     that eleven exports in lib/auth/permissions.ts were keyed by.
--   * The P1/P1B tables (`role_templates`, `role_template_permissions`,
--     `membership_roles`, `membership_permissions`, and the `legacy_column`
--     bridge on `permissions`). Those were the first two phases of a seven-phase
--     migration that assumed live data to preserve. There is none - this is
--     pre-launch - so the clean-slate target state supersedes them. They are
--     dropped rather than migrated because P1 left them deliberately inert:
--     nothing in app/, features/ or lib/ ever read a row.
--
-- WHAT IT INTRODUCES
-- ------------------
-- Grants attach to a PRINCIPAL - a tenant-scoped subject that a human membership
-- or a machine account points at. Revocation, expiry, scope and audit are then
-- written once instead of once per kind of caller.
--
-- Adding a role becomes an INSERT. No role name appears in application code.
--
-- WHAT IT DOES NOT DO
-- -------------------
-- It does not seed. The 62 catalog rows and the five starter roles per tenant
-- are derived by `npm run db:seed-authorization` from lib/authz/catalog.ts and
-- lib/authz/starter-roles.ts, rather than restated here as SQL literals. A
-- second copy of the matrix is free to drift from the first, and that is exactly
-- the failure the catalog exists to prevent.
--
--   >>> RUN `npm run db:seed-authorization` IMMEDIATELY AFTER THIS MIGRATION.
--   >>> Between the two, every principal holds nothing and every guarded route
--   >>> 403s. That is the correct failure - deny by default - but it is not a
--   >>> state to leave a database in.
--
-- Step 1 below captures what the dropped columns said, into
-- `_authz_legacy_backfill`, so the seed can translate each existing membership
-- into a starter-role assignment with the right hall scope. The seed drops that
-- table when it is done.
--
-- NOT CARRIED OVER, DELIBERATELY: per-member tweaks to the 23 booleans that
-- differ from their role's defaults. The flags they encoded are being replaced,
-- not renamed - `canViewEventManager` alone became five keys - so any mapping
-- would be a guess wearing the authority of a migration. Re-apply them as
-- individual GRANT/DENY overrides from the access screen, which is one row each
-- and auditable, unlike the columns they came from.
--
-- HAND-WRITTEN, like every migration in this repo. `prisma migrate dev` is
-- banned here: the live `user_access` still carries two columns the schema
-- dropped, so migrate dev folds destructive DROP COLUMNs into whatever else it
-- generates. Apply with `npm run db:deploy`, and run `prisma migrate status`
-- first - anything else pending belongs to another branch.
--
-- SHARED DATABASE. Every branch's dev server points at this one Supabase
-- project, and this migration DROPS COLUMNS THAT EVERY OTHER BRANCH STILL READS.
-- Merge to main the same day, tell branch owners to rebase, and expect every
-- unrebased branch to break the moment this lands - there is no additive
-- sequencing that avoids it, because the whole point is that the old privilege
-- path stops existing.
--
-- INVISIBLE TO PRISMA and lost to any `migrate diff` over these tables: the
-- CHECK constraints on principals.kind, principal_roles.scope_type,
-- principal_roles.source, principal_permissions.effect, the org-scope identity
-- CHECK, and the two epoch-bump trigger functions with their three triggers.

-- DDL below takes ACCESS EXCLUSIVE on organizations, organization_memberships
-- and users, on the database every branch's dev server uses. Fail fast rather
-- than queue behind a long read and block everyone.
--
-- Plain SET, not SET LOCAL: SET LOCAL outside a transaction is a no-op that only
-- emits a WARNING, so if Prisma ever stops wrapping migration files the timeout
-- would silently stop applying.
SET lock_timeout = '3s';

-- ---------------------------------------------------------------------------
-- 1. Capture what the dropped columns said, BEFORE dropping them.
--
--    `allowed_hall_ids` is the part that matters most. It is the current
--    product's only scoping mechanism, and it becomes hall-scoped assignments -
--    losing it would silently widen every scoped member to the whole tenant,
--    which is the one backfill mistake that fails open.
-- ---------------------------------------------------------------------------

CREATE TABLE "_authz_legacy_backfill" (
  "membership_id"    UUID NOT NULL,
  "organization_id"  UUID NOT NULL,
  "user_id"          UUID NOT NULL,
  "legacy_role"      TEXT NOT NULL,
  "allowed_hall_ids" TEXT[] NOT NULL DEFAULT '{}',

  CONSTRAINT "_authz_legacy_backfill_pkey" PRIMARY KEY ("membership_id")
);

INSERT INTO "_authz_legacy_backfill"
  ("membership_id", "organization_id", "user_id", "legacy_role", "allowed_hall_ids")
SELECT membership."id",
       membership."organization_id",
       membership."user_id",
       -- The membership's role, never `users.role`. The global column is the one
       -- that let an invite's role leak into somebody else's tenant; it is being
       -- dropped and must not be the thing that decides what people keep.
       COALESCE(NULLIF(TRIM(membership."role"), ''), 'viewer'),
       COALESCE(access."allowed_hall_ids", '{}')
  FROM "organization_memberships" AS membership
  LEFT JOIN "user_access" AS access
         ON access."user_id" = membership."user_id"
        AND access."organization_id" = membership."organization_id";

-- ---------------------------------------------------------------------------
-- 2. Drop the superseded privilege paths.
--
--    Order is dependency-first so no CASCADE is needed. A CASCADE here could
--    quietly take a table this file does not know about, and the whole reason
--    these are hand-written is that nothing should be quiet.
-- ---------------------------------------------------------------------------

DROP TABLE IF EXISTS "membership_permissions";
DROP TABLE IF EXISTS "membership_roles";
DROP TABLE IF EXISTS "role_template_permissions";
DROP TABLE IF EXISTS "role_templates";
DROP TABLE IF EXISTS "role_permissions";
DROP TABLE IF EXISTS "roles";
DROP TABLE IF EXISTS "permissions";
-- Recreated below with a principal subject instead of a user subject, so a
-- change to a service account's grants lands in the same table and is read by
-- the same screen. Empty today: P2 was the phase that would have started
-- writing it, and P2 never shipped.
DROP TABLE IF EXISTS "authorization_audit";
DROP TABLE IF EXISTS "user_access";

-- The composite-FK target P1 added for `membership_roles` and
-- `membership_permissions`. Both are gone, and the schema no longer declares it,
-- so leaving it behind would read as drift forever.
ALTER TABLE "organization_memberships"
  DROP CONSTRAINT IF EXISTS "organization_memberships_id_organization_id_key";

-- ---------------------------------------------------------------------------
-- 3. The epoch becomes a bigint.
--
--    A counter with no reset needs more headroom than int4's 2.1 billion. It
--    crosses the wire as a Number, which is exact below 2^53 - a ceiling no
--    amount of privilege editing reaches.
-- ---------------------------------------------------------------------------

ALTER TABLE "organizations"
  ALTER COLUMN "permissions_epoch" TYPE BIGINT;

-- ---------------------------------------------------------------------------
-- 4. Principals.
--
--    The structural choice the whole design rests on. `UNIQUE (id,
--    organization_id)` is not uniqueness anyone needed - `id` is already the
--    primary key - it is the composite-FK target that makes a cross-tenant grant
--    row impossible to write rather than merely forbidden.
-- ---------------------------------------------------------------------------

CREATE TABLE "principals" (
  "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "kind"            TEXT NOT NULL,
  "is_active"       BOOLEAN NOT NULL DEFAULT true,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "principals_pkey" PRIMARY KEY ("id"),
  -- INVISIBLE TO PRISMA.
  CONSTRAINT "principals_kind_check" CHECK ("kind" IN ('user', 'service'))
);

ALTER TABLE "principals"
  ADD CONSTRAINT "principals_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "principals_id_organization_id_key"
  ON "principals" ("id", "organization_id");
CREATE INDEX "principals_organization_id_is_active_idx"
  ON "principals" ("organization_id", "is_active");

-- ---------------------------------------------------------------------------
-- 5. Every existing membership gets one.
--
--    `principal_id` is generated on the membership first, so the two tables can
--    be correlated without a RETURNING clause that has nothing to join back to.
--
--    `is_active` is left true even for a deactivated membership. Deactivation
--    flips the MEMBERSHIP, never a global flag - a person in two tenants must
--    not be locked out of one by the other - and the resolver checks both.
-- ---------------------------------------------------------------------------

ALTER TABLE "organization_memberships" ADD COLUMN "principal_id" UUID;

UPDATE "organization_memberships"
   SET "principal_id" = gen_random_uuid()
 WHERE "principal_id" IS NULL;

INSERT INTO "principals" ("id", "organization_id", "kind", "is_active", "created_at", "updated_at")
SELECT membership."principal_id",
       membership."organization_id",
       'user',
       true,
       membership."created_at",
       CURRENT_TIMESTAMP
  FROM "organization_memberships" AS membership;

ALTER TABLE "organization_memberships"
  ALTER COLUMN "principal_id" SET NOT NULL;

CREATE UNIQUE INDEX "organization_memberships_principal_id_key"
  ON "organization_memberships" ("principal_id");
CREATE UNIQUE INDEX "organization_memberships_principal_id_organization_id_key"
  ON "organization_memberships" ("principal_id", "organization_id");

ALTER TABLE "organization_memberships"
  ADD CONSTRAINT "organization_memberships_principal_id_organization_id_fkey"
  FOREIGN KEY ("principal_id", "organization_id")
  REFERENCES "principals"("id", "organization_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 6. The role strings go.
--
--    `users.role` is the dangerous one. It was global - one row per person
--    across every tenant they belong to - so an invite written into it in one
--    organization was copied into the invitee's PRIMARY organization at their
--    next sign-in. `users.title` replaces it with what the staff directory
--    actually wanted: a job title, which is not a privilege.
-- ---------------------------------------------------------------------------

ALTER TABLE "organization_memberships" DROP COLUMN "role";

ALTER TABLE "users" DROP COLUMN "role";
ALTER TABLE "users" ADD COLUMN "title" TEXT;

-- ---------------------------------------------------------------------------
-- 7. Service accounts.
--
--    A machine caller proves identity with a bearer token and then IS a
--    principal. This table adds an authentication mechanism, not a second
--    authorization model - the assignment and override paths already work on it.
-- ---------------------------------------------------------------------------

CREATE TABLE "service_accounts" (
  "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "principal_id"    UUID NOT NULL,
  "name"            TEXT NOT NULL,
  "token_hash"      TEXT NOT NULL,
  "last_used_at"    TIMESTAMPTZ(3),
  "expires_at"      TIMESTAMPTZ(3),
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "service_accounts_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "service_accounts"
  ADD CONSTRAINT "service_accounts_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "service_accounts"
  ADD CONSTRAINT "service_accounts_principal_id_organization_id_fkey"
  FOREIGN KEY ("principal_id", "organization_id")
  REFERENCES "principals"("id", "organization_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "service_accounts_principal_id_key"
  ON "service_accounts" ("principal_id");
CREATE UNIQUE INDEX "service_accounts_principal_id_organization_id_key"
  ON "service_accounts" ("principal_id", "organization_id");
CREATE UNIQUE INDEX "service_accounts_token_hash_key"
  ON "service_accounts" ("token_hash");
CREATE INDEX "service_accounts_organization_id_idx"
  ON "service_accounts" ("organization_id");

-- ---------------------------------------------------------------------------
-- 8. The permission catalog. Global, not per-tenant.
-- ---------------------------------------------------------------------------

CREATE TABLE "permissions" (
  "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
  "key"          TEXT NOT NULL,
  "label"        TEXT NOT NULL,
  "description"  TEXT NOT NULL,
  "group_label"  TEXT NOT NULL,
  "is_dangerous" BOOLEAN NOT NULL DEFAULT false,
  "sort_order"   INTEGER NOT NULL,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "permissions_key_key" ON "permissions" ("key");
CREATE INDEX "permissions_sort_order_idx" ON "permissions" ("sort_order");

-- ---------------------------------------------------------------------------
-- 9. Roles. Always owned by exactly one tenant - there is no such thing as a
--    global role, which is what lets a tenant edit every cell of the starter
--    five.
-- ---------------------------------------------------------------------------

CREATE TABLE "roles" (
  "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "key"             TEXT NOT NULL,
  "name"            TEXT NOT NULL,
  "description"     TEXT,
  "rank"            INTEGER NOT NULL,
  "is_system"       BOOLEAN NOT NULL DEFAULT false,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "roles"
  ADD CONSTRAINT "roles_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "roles_organization_id_key_key"
  ON "roles" ("organization_id", "key");
-- The composite-FK target for `principal_roles`.
CREATE UNIQUE INDEX "roles_id_organization_id_key"
  ON "roles" ("id", "organization_id");
CREATE INDEX "roles_organization_id_idx" ON "roles" ("organization_id");

CREATE TABLE "role_permissions" (
  "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
  "role_id"       UUID NOT NULL,
  "permission_id" UUID NOT NULL,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

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
-- 10. Assignments. An assignment is a resource, not a join row.
--
--     BOTH foreign keys are composite and both carry organization_id, so a row
--     naming a principal in one tenant and a role in another cannot be written.
--
--     scope_type and scope_id are both NOT NULL, with 'org' storing the
--     organization's own id rather than a null. A nullable scope_id would need
--     NULLS NOT DISTINCT on the unique index - which Prisma cannot emit - and
--     would satisfy any composite foreign key vacuously under MATCH SIMPLE,
--     silently skipping exactly the rows the key exists to cover. That is the
--     trap P1B already spent a migration escaping on roles.organization_id.
-- ---------------------------------------------------------------------------

CREATE TABLE "principal_roles" (
  "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
  "principal_id"    UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "role_id"         UUID NOT NULL,
  "scope_type"      TEXT NOT NULL,
  "scope_id"        UUID NOT NULL,
  "expires_at"      TIMESTAMPTZ(3),
  "granted_by"      UUID,
  "source"          TEXT NOT NULL DEFAULT 'manual',
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "principal_roles_pkey" PRIMARY KEY ("id"),
  -- INVISIBLE TO PRISMA, all three.
  CONSTRAINT "principal_roles_scope_type_check"
    CHECK ("scope_type" IN ('org', 'hall', 'event_type')),
  CONSTRAINT "principal_roles_source_check"
    CHECK ("source" IN ('manual', 'scim', 'idp_group')),
  -- An 'org' assignment stores the organization's own id. Without this, 'org'
  -- rows could carry an arbitrary uuid and the unique index below would let the
  -- same assignment exist twice under two different meaningless scope_ids.
  CONSTRAINT "principal_roles_org_scope_identity_check"
    CHECK ("scope_type" <> 'org' OR "scope_id" = "organization_id")
);

ALTER TABLE "principal_roles"
  ADD CONSTRAINT "principal_roles_principal_id_organization_id_fkey"
  FOREIGN KEY ("principal_id", "organization_id")
  REFERENCES "principals"("id", "organization_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "principal_roles"
  ADD CONSTRAINT "principal_roles_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- RESTRICT, not CASCADE: deleting a role people still hold must fail loudly.
-- The API returns 409 role_in_use, and the database refuses even if that check
-- is bypassed.
ALTER TABLE "principal_roles"
  ADD CONSTRAINT "principal_roles_role_id_organization_id_fkey"
  FOREIGN KEY ("role_id", "organization_id")
  REFERENCES "roles"("id", "organization_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "principal_roles"
  ADD CONSTRAINT "principal_roles_granted_by_fkey"
  FOREIGN KEY ("granted_by") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "principal_roles_principal_id_role_id_scope_type_scope_id_key"
  ON "principal_roles" ("principal_id", "role_id", "scope_type", "scope_id");
CREATE INDEX "principal_roles_organization_id_idx"
  ON "principal_roles" ("organization_id");
CREATE INDEX "principal_roles_role_id_idx" ON "principal_roles" ("role_id");
CREATE INDEX "principal_roles_principal_id_organization_id_idx"
  ON "principal_roles" ("principal_id", "organization_id");

-- ---------------------------------------------------------------------------
-- 11. Individual exceptions. DENY is subtractive and final.
-- ---------------------------------------------------------------------------

CREATE TABLE "principal_permissions" (
  "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
  "principal_id"    UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "permission_id"   UUID NOT NULL,
  "effect"          TEXT NOT NULL,
  "granted_by"      UUID,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "principal_permissions_pkey" PRIMARY KEY ("id"),
  -- INVISIBLE TO PRISMA.
  CONSTRAINT "principal_permissions_effect_check"
    CHECK ("effect" IN ('GRANT', 'DENY'))
);

ALTER TABLE "principal_permissions"
  ADD CONSTRAINT "principal_permissions_principal_id_organization_id_fkey"
  FOREIGN KEY ("principal_id", "organization_id")
  REFERENCES "principals"("id", "organization_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "principal_permissions"
  ADD CONSTRAINT "principal_permissions_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "principal_permissions"
  ADD CONSTRAINT "principal_permissions_permission_id_fkey"
  FOREIGN KEY ("permission_id") REFERENCES "permissions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "principal_permissions"
  ADD CONSTRAINT "principal_permissions_granted_by_fkey"
  FOREIGN KEY ("granted_by") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "principal_permissions_principal_id_permission_id_key"
  ON "principal_permissions" ("principal_id", "permission_id");
CREATE INDEX "principal_permissions_organization_id_idx"
  ON "principal_permissions" ("organization_id");
CREATE INDEX "principal_permissions_principal_id_organization_id_idx"
  ON "principal_permissions" ("principal_id", "organization_id");

-- ---------------------------------------------------------------------------
-- 12. The audit trail, subjected to a principal.
--
--     actor_name / subject_name are snapshots for the same reason
--     activity_logs.user_name is: both foreign keys are SET NULL, so without the
--     snapshot a deleted user's audit entry stops naming anyone - which is
--     exactly when the entry matters most.
-- ---------------------------------------------------------------------------

CREATE TABLE "authorization_audit" (
  "id"                   UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id"      UUID NOT NULL,
  "actor_id"             UUID,
  "actor_name"           TEXT NOT NULL,
  "subject_principal_id" UUID,
  "subject_name"         TEXT,
  "action"               TEXT NOT NULL,
  "detail"               JSONB,
  "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

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
  ADD CONSTRAINT "authorization_audit_subject_principal_id_fkey"
  FOREIGN KEY ("subject_principal_id") REFERENCES "principals"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "authorization_audit_organization_id_created_at_idx"
  ON "authorization_audit" ("organization_id", "created_at");
CREATE INDEX "authorization_audit_subject_principal_id_idx"
  ON "authorization_audit" ("subject_principal_id");
CREATE INDEX "authorization_audit_organization_id_action_created_at_idx"
  ON "authorization_audit" ("organization_id", "action", "created_at");

-- ---------------------------------------------------------------------------
-- 13. The epoch bump, as triggers.
--
--     FROM THE DATABASE, NOT THE APPLICATION. A trigger cannot be forgotten by a
--     future write path; an application-side bump can, and the failure mode of
--     forgetting is a user keeping a permission that was revoked minutes ago.
--
--     The UPDATE takes a row lock on `organizations`, which also serialises
--     concurrent matrix edits and closes the read-modify-write window by
--     construction - two administrators with the same checkbox grid open cannot
--     interleave.
--
--     TWO FUNCTIONS, not one with a TG_TABLE_NAME branch: `role_permissions` has
--     no organization_id and has to reach through `roles`, and a single function
--     touching a column that does not exist on one of its tables is a runtime
--     error waiting for the first DELETE.
--
--     NO TRIGGER ON `roles` ITSELF. Deleting a role that anyone holds is blocked
--     by the RESTRICT above, so a role that CAN be deleted is one no assignment
--     references - and therefore one no cached decision depends on. Renaming or
--     re-ranking a role likewise changes no effective set.
--
--     INVISIBLE TO PRISMA, all of it.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.authz_bump_epoch_by_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  affected_organizations pg_catalog.uuid[] := ARRAY[]::pg_catalog.uuid[];
BEGIN
  -- OLD is unassigned on INSERT and NEW on DELETE, so each is read only where
  -- it exists rather than guarded with COALESCE over a null record.
  IF TG_OP <> 'INSERT' THEN
    affected_organizations := affected_organizations || OLD.organization_id;
  END IF;

  IF TG_OP <> 'DELETE' THEN
    affected_organizations := affected_organizations || NEW.organization_id;
  END IF;

  UPDATE public.organizations
     SET permissions_epoch = permissions_epoch + 1
   WHERE id = ANY(affected_organizations);

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.authz_bump_epoch_by_organization() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.authz_bump_epoch_by_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  affected_roles pg_catalog.uuid[] := ARRAY[]::pg_catalog.uuid[];
BEGIN
  IF TG_OP <> 'INSERT' THEN
    affected_roles := affected_roles || OLD.role_id;
  END IF;

  IF TG_OP <> 'DELETE' THEN
    affected_roles := affected_roles || NEW.role_id;
  END IF;

  UPDATE public.organizations AS organization
     SET permissions_epoch = organization.permissions_epoch + 1
   WHERE organization.id IN (
           SELECT role_row.organization_id
             FROM public.roles AS role_row
            WHERE role_row.id = ANY(affected_roles)
         );

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.authz_bump_epoch_by_role() FROM PUBLIC;

CREATE TRIGGER "principal_roles_bump_epoch"
  AFTER INSERT OR UPDATE OR DELETE ON "principal_roles"
  FOR EACH ROW EXECUTE FUNCTION public.authz_bump_epoch_by_organization();

CREATE TRIGGER "principal_permissions_bump_epoch"
  AFTER INSERT OR UPDATE OR DELETE ON "principal_permissions"
  FOR EACH ROW EXECUTE FUNCTION public.authz_bump_epoch_by_organization();

CREATE TRIGGER "role_permissions_bump_epoch"
  AFTER INSERT OR UPDATE OR DELETE ON "role_permissions"
  FOR EACH ROW EXECUTE FUNCTION public.authz_bump_epoch_by_role();

-- ---------------------------------------------------------------------------
-- 14. Row-level security on the privilege tables.
--
--     RLS enabled, every privilege revoked from anon and authenticated, and NO
--     POLICY AT ALL. Never the tenant FOR ALL policy the ordinary tables carry,
--     and never FOR SELECT either.
--
--     All of these have an organization_id column and will therefore pass the
--     mechanical "does it have a tenant column?" test the next maintainer
--     applies to the loop in prisma/supabase-rls.sql. Read that policy against
--     principal_permissions, whose every row means "this principal holds this
--     permission": a WITH CHECK that asks only whether the writer belongs to the
--     organization is satisfied by every member, so any member could insert a
--     row granting themselves anything. FOR SELECT is not sufficient either - it
--     exposes every colleague's grant map.
--
--     Today this documents intent rather than enforcing it: `authenticated`
--     holds no privilege on any table in public and pg_default_acl has no row
--     for the schema, so these tables are born unreachable and every policy in
--     supabase-rls.sql has never executed. The REVOKE states the intent for the
--     day somebody runs a blanket GRANT - and because Postgres ACLs have no
--     DENY, the absent POLICY is the only line here that would survive one.
--
--     tests/unit/privilege-table-policies.test.ts is the control, because a
--     comment is not one.
-- ---------------------------------------------------------------------------

ALTER TABLE "principals" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.principals FROM anon, authenticated;

ALTER TABLE "service_accounts" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.service_accounts FROM anon, authenticated;

ALTER TABLE "permissions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.permissions FROM anon, authenticated;

ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.roles FROM anon, authenticated;

ALTER TABLE "role_permissions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.role_permissions FROM anon, authenticated;

ALTER TABLE "principal_roles" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.principal_roles FROM anon, authenticated;

ALTER TABLE "principal_permissions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.principal_permissions FROM anon, authenticated;

ALTER TABLE "authorization_audit" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.authorization_audit FROM anon, authenticated;

-- The backfill scratch table holds no privilege of its own, but it does name
-- every membership and its hall scope. Same treatment, and the seed drops it.
ALTER TABLE "_authz_legacy_backfill" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."_authz_legacy_backfill" FROM anon, authenticated;
