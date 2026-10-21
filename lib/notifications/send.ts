import "server-only";

import type { PermissionKey } from "@/lib/authz/catalog";
import type { ScopeFilter } from "@/lib/authz/types";
import { effectiveAccessByPrincipal } from "@/lib/authz/decide";
import { log } from "@/lib/logging/context";
import { sendTransactionalEmail } from "@/lib/email/send";
import { prisma } from "@/lib/prisma";
import {
  selectNotificationRecipients,
  type NotificationCandidate,
  type NotificationSubject
} from "@/lib/notifications/recipients";

/**
 * SENDING THE EMAIL, once the selector has said who to.
 *
 * Three responsibilities and they are kept apart on purpose:
 *
 *   `recipients.ts`  decides WHO. Pure, exhaustively tested, no database.
 *   this file        gathers the facts, sends, and records that it sent.
 *   the call sites   say WHAT happened and nothing else.
 *
 * NOTHING HERE MAY FAIL THE MUTATION IT FOLLOWS. A booking that was created is
 * created; an email provider being down does not undo it, and a 500 at that
 * point tells somebody their booking failed when it did not - and the natural
 * response, pressing Save again, makes two. Every path below either returns or
 * logs.
 *
 * WHAT MAY BE LOGGED, per docs/logging.md and the privacy rules this feature
 * carries: counts, ids, the notification kind, and stable snake_case event
 * names. Never an address, never a recipient list, never a subject line or a
 * body, never a URL.
 */

type EventContext = {
  organizationId: string;
  /** The permissions epoch these access decisions are computed under. */
  epoch: bigint;
  eventId: string | null;
  hallId: string | null;
  /**
   * `events.coordinatorMembershipId`, NOT a user id.
   *
   * Taken in the form the event actually stores it and resolved below, rather
   * than making every call site remember that the coordinator is a membership.
   * The selector works in user ids, because preferences and activity are facts
   * about a person rather than about one of their memberships.
   */
  coordinatorMembershipId: string | null;
};

/**
 * Everybody who could conceivably be told, with the facts the selector needs.
 *
 * ONE QUERY FOR THE PEOPLE, then one cached access resolution each.
 * `effectiveAccessByPrincipal` is memoised per principal per epoch and
 * coalesces concurrent callers, so a venue of twenty staff costs twenty cache
 * lookups on the second notification of a request rather than twenty queries.
 */
async function loadCandidates(context: EventContext): Promise<{
  candidates: NotificationCandidate[];
  coordinatorUserId: string | null;
}> {
  const memberships = await prisma.organizationMembership.findMany({
    where: {
      organizationId: context.organizationId,
      isActive: true,
      user: { isActive: true }
    },
    select: {
      id: true,
      principalId: true,
      user: {
        select: {
          id: true,
          email: true,
          isActive: true,
          notificationPreferences: {
            where: { organizationId: context.organizationId },
            select: {
              emailNotifications: true,
              eventConfirmations: true,
              billingAlerts: true,
              systemAnnouncements: true
            },
            take: 1
          }
        }
      }
    }
  });

  /**
   * Who is named on a kitchen line for this event.
   *
   * What lets a cook without whole-board access hear about the one event they
   * are working on. Loaded once for everybody rather than per candidate - the
   * alternative is a query per member per notification.
   */
  const assignedUserIds = context.eventId
    ? await loadAssignedKitchenUserIds(context.organizationId, context.eventId)
    : new Set<string>();

  const candidates = await Promise.all(
    memberships.map(async (membership) => {
      const access = await effectiveAccessByPrincipal(
        membership.principalId,
        context.organizationId,
        context.epoch
      );

      return {
        userId: membership.user.id,
        email: membership.user.email,
        isActive: membership.user.isActive,
        preferences: membership.user.notificationPreferences[0] ?? null,
        permissions: access.permissions as ReadonlyMap<
          PermissionKey,
          ScopeFilter
        >,
        isAssignedToEventKitchen: assignedUserIds.has(membership.user.id)
      } satisfies NotificationCandidate;
    })
  );

  // The coordinator is stored as a MEMBERSHIP, and the selector works in
  // user ids. Resolved from the rows already loaded rather than with a second
  // query - and a coordinator whose membership has since been switched off
  // simply is not here, which is the right answer.
  const coordinator = memberships.find(
    (membership) => membership.id === context.coordinatorMembershipId
  );

  return { candidates, coordinatorUserId: coordinator?.user.id ?? null };
}

/** The users behind the kitchen workers assigned to any line on this event. */
async function loadAssignedKitchenUserIds(
  organizationId: string,
  eventId: string
): Promise<Set<string>> {
  const statuses = await prisma.kitchenItemStatus.findMany({
    where: {
      organizationId,
      eventId,
      assignedWorkerId: { not: null }
    },
    select: { assignedWorker: { select: { userId: true } } }
  });

  return new Set(
    statuses
      .map((status) => status.assignedWorker?.userId)
      .filter((userId): userId is string => Boolean(userId))
  );
}

/**
 * Send one notification, to whoever is entitled to it and asked for it.
 *
 * `dedupeKey` is what makes a retried request send one email rather than two.
 * `POST /api/events` accepts an `Idempotency-Key`, and a client that retries a
 * timed-out request is doing the right thing - the booking is created once and
 * the confirmation has to go out once with it. The unique index on
 * `notification_deliveries` is the enforcement; the insert below is attempted
 * FIRST, so two concurrent replays cannot both pass a check-then-write.
 */
export async function sendNotification(input: {
  context: EventContext;
  subject: NotificationSubject;
  dedupeKey: string;
  email: { subject: string; html: string };
}): Promise<{ sent: number } | { skipped: "duplicate" | "error" }> {
  const { context, subject, dedupeKey } = input;

  try {
    // CLAIM FIRST, SEND SECOND. Claiming after sending would let two concurrent
    // replays both find no row and both send. Claiming first means the loser of
    // the race sends nothing, which is the right way round: a missed duplicate
    // is invisible and a sent duplicate is not.
    try {
      await prisma.notificationDelivery.create({
        data: {
          organizationId: context.organizationId,
          dedupeKey,
          kind: subject.kind
        }
      });
    } catch {
      // The unique index refused it, so this notification has already been
      // handled. Not an error and not worth a warning - it is the mechanism
      // working.
      log.info({ kind: subject.kind }, "notification_already_delivered");

      return { skipped: "duplicate" };
    }

    const { candidates, coordinatorUserId } = await loadCandidates(context);
    const recipients = selectNotificationRecipients({
      // The coordinator resolved from the membership the event stores, so the
      // call sites hand over what they actually have.
      subject: { ...subject, coordinatorUserId },
      candidates
    });

    if (recipients.length === 0) {
      // Worth a line: "nobody was emailed" is a frequent support question, and
      // the answer is almost always a preference or a scope rather than a bug.
      log.info(
        { kind: subject.kind, candidates: candidates.length, recipients: 0 },
        "notification_no_recipients"
      );

      return { sent: 0 };
    }

    const delivered = await deliver(recipients.map((one) => one.email), input.email);

    await prisma.notificationDelivery.updateMany({
      where: { organizationId: context.organizationId, dedupeKey },
      data: { recipientCount: delivered }
    });

    // Counts and the kind. No addresses, no subject line, no body.
    log.info(
      {
        kind: subject.kind,
        eventId: context.eventId,
        candidates: candidates.length,
        recipients: recipients.length,
        delivered
      },
      "notification_sent"
    );

    return { sent: delivered };
  } catch (notificationError) {
    /**
     * The mutation this follows has already committed. Throwing would tell
     * somebody their booking failed when it did not, and the natural response -
     * pressing Save again - makes two bookings.
     *
     * `err` is stringified rather than spread: a provider error can carry the
     * request it failed on, and that request contains addresses.
     */
    log.warn(
      { kind: subject.kind, err: String(notificationError) },
      "notification_not_sent"
    );

    return { skipped: "error" };
  }
}

/**
 * The provider call. Returns how many were accepted.
 *
 * One request per recipient rather than one with many `to` addresses: a single
 * message addressed to eight people shows all eight addresses to all eight,
 * which is a disclosure nobody asked for and the classic way this feature leaks
 * a staff list.
 *
 * `trackedFetch` per the repository contract, with a bounded vendor and a
 * low-cardinality operation. It logs neither the URL nor the body.
 */
async function deliver(
  addresses: string[],
  email: { subject: string; html: string }
): Promise<number> {
  const results = await Promise.allSettled(
    addresses.map((to) =>
      sendTransactionalEmail({ to, subject: email.subject, html: email.html })
    )
  );

  // A rejection is a refusal by the provider; a alse is no provider being
  // configured at all. Neither reached anybody, so neither counts as sent.
  const failed = results.filter(
    (result) => result.status === "rejected" || result.value === false
  ).length;

  if (failed > 0) {
    log.warn({ failed, total: addresses.length }, "notification_partial_failure");
  }

  return results.length - failed;
}
