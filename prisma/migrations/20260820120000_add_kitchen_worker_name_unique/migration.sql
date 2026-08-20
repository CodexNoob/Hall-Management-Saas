-- CreateIndex
-- One worker per name per organization, compared case-insensitively.
--
-- Case-insensitive because this is a short list people retype rather than pick
-- from: "Mendy" beside "mendy" is two workers to assign to, two rows in any
-- report that groups by worker, and no way for the person reading it to tell
-- they are the same man.
--
-- A functional index rather than a Prisma `@@unique`, which cannot express
-- `lower()`. `schema.prisma` therefore documents this constraint instead of
-- declaring it - see the note on `model KitchenWorker`.
--
-- No backfill and no dedupe step: `kitchen_workers` is empty in every one of
-- the seven organizations, because until now nothing in the product could
-- create a row. Verified against the database before writing this.
CREATE UNIQUE INDEX "kitchen_workers_organization_id_lower_name_key"
  ON "kitchen_workers" ("organization_id", lower("name"));
