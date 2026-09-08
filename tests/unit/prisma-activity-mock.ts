import { vi } from "vitest";

/**
 * A Prisma mock that can run an interactive transaction and record activity.
 *
 * Every mutating route now writes one `activity_logs` row inside
 * `prisma.$transaction`, so a hand-built mock with neither hands the handler an
 * `undefined` and the route answers 500 - which is a test failing for a reason
 * that has nothing to do with what it is testing.
 *
 * `$transaction` passes THE MOCK ITSELF as the transaction client, which is what
 * makes an assertion on `prisma.menuItem.update` keep working unchanged whether
 * the route wraps it or not. That is deliberately not a faithful model of a
 * transaction - nothing here rolls back - but a unit test asserting on the call
 * it made does not need one, and the alternative is a second set of spies per
 * file.
 *
 * The array form is supported too, for the batch writes (`menu/import`).
 *
 * Called from inside a `vi.mock` factory, so it cannot close over anything the
 * test file imports:
 *
 *   vi.mock("@/lib/prisma", async () => {
 *     const { withActivityLog } = await import("./prisma-activity-mock");
 *     return { prisma: withActivityLog({ menuItem: { update: vi.fn() } }) };
 *   });
 */
export function withActivityLog<T extends Record<string, unknown>>(
  models: T
): T & {
  activityLog: { create: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
} {
  const prisma = {
    ...models,
    // Present unless the caller supplied its own - a few files assert on the
    // exact `activityLog.create` argument and build the spy themselves.
    activityLog: (models.activityLog as { create: ReturnType<typeof vi.fn> }) ?? {
      create: vi.fn().mockResolvedValue({ id: "activity-log" })
    }
  } as T & {
    activityLog: { create: ReturnType<typeof vi.fn> };
    $transaction: ReturnType<typeof vi.fn>;
  };

  prisma.$transaction = vi.fn(
    async (argument: unknown) =>
      typeof argument === "function"
        ? (argument as (client: unknown) => unknown)(prisma)
        : Promise.all(argument as unknown[])
  );

  return prisma;
}
