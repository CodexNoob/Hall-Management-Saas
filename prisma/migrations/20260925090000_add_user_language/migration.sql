-- A person's own dashboard language.
--
-- Nullable with no default, because null is a meaningful value here: it means
-- "follow the organization", which is what every existing row should keep
-- doing. A default of 'en-US' would silently opt every current user out of an
-- organization that had already chosen Spanish or Hebrew.
ALTER TABLE "users" ADD COLUMN "language" TEXT;
