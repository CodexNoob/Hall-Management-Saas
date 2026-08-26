/**
 * How much of the kitchen one caller is allowed to see, and the pure rules that
 * apply it.
 *
 * DELIBERATELY FREE OF PRISMA AND `server-only`. `kitchen-sheet.ts` imports this
 * to filter a sheet as it builds one, and that module is unit-tested outside any
 * Next.js server context - pulling a Prisma client in through here would
 * construct one at import time and take those tests down with it. Reading the
 * caller's roster row is therefore a separate module,
 * `kitchen-visibility-resolve.ts`, which the routes call and hand the result in.
 *
 * Two routes answer with kitchen sheets - the board (`/api/kitchen`) and one
 * event's dishes (`/api/events/[eventId]/kitchen`) - and a restriction that held
 * on one but not the other would be no restriction at all: the details dialog
 * fetches the second, so a cook who could not see a dish on the board could
 * still read it by opening the event card. These rules are the single answer
 * both of them apply.
 *
 * `kitchen.read` opens the board. `kitchen.read.all` decides whether the board
 * is the whole kitchen or only the caller's own dishes. Kitchen Manager, Event
 * Manager, Administrator, Owner and Viewer hold the second key; Kitchen Staff
 * deliberately does not.
 */
export type KitchenVisibility = {
  /** Every event and every line, unfiltered. */
  seesWholeBoard: boolean;
  /**
   * The caller's own `KitchenWorker` row, when they have one.
   *
   * Null for anyone who is not on the roster. Combined with `seesWholeBoard:
   * false` that means "may open the kitchen, is assigned nothing", and the
   * filters below then return nothing - the safe direction. Anyone who should
   * see the board is given the key rather than left to this fallback.
   */
  workerId: string | null;
};

/** What an unrestricted caller gets, and the default for every non-kitchen path. */
export const WHOLE_KITCHEN: KitchenVisibility = {
  seesWholeBoard: true,
  workerId: null
};

type AssignableLine = {
  assignedWorkerId?: string | null;
};

/**
 * The lines this caller may be sent.
 *
 * Add-on lines carry no assignment, so under "only what is assigned to me" they
 * belong to nobody and are withheld from a scoped caller. That is a product
 * choice rather than a technical one, and it keeps the sheet honest: a cook
 * shown two add-ons and none of the eight dishes around them would read that as
 * the whole job. One line to change if add-ons should always ride along.
 */
export function visibleKitchenLines<Line extends AssignableLine>(
  lines: readonly Line[],
  visibility: KitchenVisibility
): Line[] {
  if (visibility.seesWholeBoard) return [...lines];
  if (!visibility.workerId) return [];

  return lines.filter((line) => line.assignedWorkerId === visibility.workerId);
}

/**
 * Whether this caller may write production status against a line.
 *
 * Read scoping alone would leave the restriction cosmetic: ids travel in URLs,
 * and a cook who cannot SEE another cook's dish could still PATCH it.
 * `kitchen.status.update` says the holder may advance production; this says
 * whose production they may advance.
 */
export function canWriteKitchenLine(
  assignedWorkerId: string | null | undefined,
  visibility: KitchenVisibility
) {
  if (visibility.seesWholeBoard) return true;
  if (!visibility.workerId) return false;

  return assignedWorkerId === visibility.workerId;
}
