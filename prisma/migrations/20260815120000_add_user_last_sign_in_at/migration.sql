ALTER TABLE "users" ADD COLUMN "last_sign_in_at" TIMESTAMP(3);

-- Left NULL on purpose. Provisioning treats "no stamp on record" as a new
-- sign-in, so every existing user logs one "auth.login.success" entry the next
-- time they sign in and then settles into one entry per session. Backfilling
-- from `created_at` would instead suppress that first genuine sign-in for
-- anyone whose Supabase `last_sign_in_at` predates this migration.
