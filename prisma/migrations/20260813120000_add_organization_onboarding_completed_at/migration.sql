ALTER TABLE "organizations" ADD COLUMN "onboarding_completed_at" TIMESTAMP(3);

-- Sign-up now only collects an email and a password, so the organization row that
-- POST /api/auth/sync-user provisions on first sign-in carries a placeholder name
-- until the owner submits /dashboard/new. NULL is what that setup gate looks for.
-- Every organization that already exists was named by the old trial form, so stamp
-- it complete; otherwise every current owner would be redirected into the form.
UPDATE "organizations"
SET "onboarding_completed_at" = "created_at";
