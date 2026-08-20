import { Prisma } from "@prisma/client";
import { z } from "zod";

/**
 * The shared pieces of the kitchen worker routes.
 *
 * Small, but split out because the collection route and the single-worker route
 * have to agree on three things exactly: what a name is allowed to be, what
 * comes back to the client, and what a duplicate looks like when the database
 * refuses one.
 */

export const workerSelect = {
  id: true,
  name: true,
  color: true,
  isActive: true
} satisfies Prisma.KitchenWorkerSelect;

export type WorkerRow = Prisma.KitchenWorkerGetPayload<{
  select: typeof workerSelect;
}>;

/**
 * Trimmed on the way in, because the uniqueness index compares `lower(name)`
 * and would happily hold "Mendy" beside "Mendy ".
 */
export const workerNameSchema = z
  .string({ invalid_type_error: "Name must be text." })
  .trim()
  .min(1, "Name is required.")
  .max(80, "Name must be 80 characters or fewer.");

/**
 * A colour to tell one worker's chips from another's at a glance.
 *
 * The column is free text, so the bound is whatever a card can render: an
 * `#rrggbb` value, or null for no colour at all. Null is the default and stays
 * distinct from a colour that happens to be white.
 */
export const workerColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Colour must be a hex value such as #1f4d73.")
  .nullable()
  .optional();

export const DUPLICATE_WORKER_MESSAGE =
  "There is already a worker with that name.";

/**
 * The unique index is functional - on `(organization_id, lower(name))` - so
 * Postgres reports it by index name rather than by column. Matching on the code
 * alone is enough here: it is the only unique constraint the table has beyond
 * its primary key, and an id collision is not something a caller can cause.
 */
export function isDuplicateWorkerError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}
