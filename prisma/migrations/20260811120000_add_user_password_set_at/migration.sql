ALTER TABLE "users" ADD COLUMN "password_set_at" TIMESTAMP(3);

-- Anyone who has already completed a sign-in owns a working credential (either a
-- password from the trial signup, or an OAuth identity), so they must not be sent
-- through the set-password screen. Only invite-created rows that have never signed
-- in keep NULL, which is what the forced setup gate looks for.
UPDATE "users"
SET "password_set_at" = "created_at"
WHERE "supabase_auth_id" IS NOT NULL;
