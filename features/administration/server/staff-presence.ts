import { prisma } from "@/lib/prisma";

/**
 * "Is this person on the dashboard right now?"
 *
 * READ FROM WHAT IS ALREADY RECORDED, NOTHING NEW IS TRACKED. Every signed-in
 * device has a `user_sessions` row carrying two clocks, and the difference
 * between them is the whole feature:
 *
 * - `lastSeenAt` moves on the session sync, which the dashboard forces every
 *   sixty seconds while the tab is VISIBLE (lib/auth/authorization-refresh.ts).
 *   It says "the app is open in front of somebody".
 * - `lastActiveAt` moves only on a real click, keypress or scroll, throttled to
 *   about one ping per five minutes. It says "a person is actually working".
 *
 * A tab left open on a desk keeps the first clock fresh forever, so presence on
 * `lastSeenAt` alone would show that person Online all day. That is what "away"
 * is for.
 *
 * SHARED DISPLAYS ARE LEFT OUT. The kitchen board is signed in as somebody and
 * is alive for hours untouched; counting it would pin whoever signed it in to
 * Online for the whole service.
 */
export type StaffPresence = "online" | "away" | "offline";

/**
 * Three missed beats. One beat is sixty seconds, and a single slow sync or a
 * laptop waking up should not flicker somebody to Offline and back.
 */
export const PRESENCE_SEEN_WINDOW_MS = 3 * 60_000;

/**
 * Twice the activity ping's throttle, so somebody working steadily never falls
 * between two pings into Away.
 */
export const PRESENCE_ACTIVE_WINDOW_MS = 10 * 60_000;

export function classifyPresence(
  input: { lastSeenAt: Date | null; lastActiveAt: Date | null },
  now: Date = new Date()
): StaffPresence {
  if (
    !input.lastSeenAt ||
    now.getTime() - input.lastSeenAt.getTime() > PRESENCE_SEEN_WINDOW_MS
  ) {
    return "offline";
  }

  // Null activity means no ping was ever recorded on this session - every
  // session from before the column existed. The schema reads that as active
  // for the timeout, and presence reads it the same way rather than inventing
  // a second meaning for the same null.
  if (
    input.lastActiveAt &&
    now.getTime() - input.lastActiveAt.getTime() > PRESENCE_ACTIVE_WINDOW_MS
  ) {
    return "away";
  }

  return "online";
}

/**
 * Presence for a set of users, in ONE grouped query rather than one per row.
 *
 * The caller passes user ids it has already resolved inside its own tenant, so
 * this never decides whose sessions to read - it only summarises them. The
 * newest beat across all of somebody's live devices wins: Online on a phone is
 * Online, whatever an old laptop says.
 */
export async function loadStaffPresence(
  userIds: string[],
  now: Date = new Date()
): Promise<Map<string, { presence: StaffPresence; lastSeenAt: string | null }>> {
  const result = new Map<
    string,
    { presence: StaffPresence; lastSeenAt: string | null }
  >();

  if (userIds.length === 0) return result;

  const rows = await prisma.userSession.groupBy({
    by: ["userId"],
    where: {
      userId: { in: userIds },
      revokedAt: null,
      sharedDevice: false
    },
    _max: { lastSeenAt: true, lastActiveAt: true }
  });

  for (const row of rows) {
    const lastSeenAt = row._max.lastSeenAt ?? null;

    result.set(row.userId, {
      presence: classifyPresence(
        { lastSeenAt, lastActiveAt: row._max.lastActiveAt ?? null },
        now
      ),
      lastSeenAt: lastSeenAt?.toISOString() ?? null
    });
  }

  return result;
}
