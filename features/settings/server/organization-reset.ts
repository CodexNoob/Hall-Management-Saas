import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordActivity } from "@/lib/audit/activity-log";
import { assignRole, ensureStarterRoles } from "@/lib/authz/provision";
import { FOUNDING_OWNER_ROLE_KEY } from "@/lib/authz/starter-roles";
import {
  RESET_DESCRIPTIONS,
  type ResetScope
} from "@/features/settings/lib/organization-reset-scopes";

/**
 * The four resets offered in Settings, and the one function that performs them.
 *
 * WHAT THIS IS FOR. An organization that has been trialling the platform with
 * invented bookings wants the demo data gone before it opens for real, and a
 * venue that has finished a season wants the board cleared. Both of those are
 * ordinary; what makes this module unusual is that every one of its paths is
 * irreversible, so the rules it follows are written down rather than implied:
 *
 * 1. NOTHING IS DELETED THAT WAS NOT NAMED. Each scope lists the rows it
 *    removes, and the list is the specification - not a `deleteMany` per model
 *    discovered by iterating the schema, which would quietly grow teeth every
 *    time somebody adds a table.
 *
 * 2. THE ORGANIZATION AND ITS OWNER SURVIVE EVERY SCOPE. The organization row,
 *    its subscription and Stripe identity, the person performing the reset,
 *    their membership and the Owner role are never touched. A reset that logs
 *    the account out of itself, or that cancels a paid plan as a side effect of
 *    clearing test bookings, is a support call rather than a feature.
 *
 * 3. CHILDREN BEFORE PARENTS, EXPLICITLY. Several of these relations are
 *    `Restrict` rather than `Cascade` (`GeneratedPdf.event` is required with no
 *    cascade, so an event holding a printed sheet cannot be deleted while it
 *    exists), and some are `SetNull`, which would leave orphan rows pointing at
 *    nothing. The order below is therefore load-bearing and is asserted by
 *    tests/unit/organization-reset.test.ts.
 *
 * 4. ONE TRANSACTION. A half-finished reset is worse than either outcome.
 */

export type ResetOutcome = {
  scope: ResetScope;
  deleted: Record<string, number>;
};

type Tx = Prisma.TransactionClient;

/**
 * Rows that exist only because an event does.
 *
 * Ordered children-first. `eventId: { not: null }` rather than every row of the
 * table: activity, email, file and folder rows also describe organization-level
 * work that no event owns, and that work is not what an event reset is for.
 */
async function deleteEventData(tx: Tx, organizationId: string) {
  const deleted: Record<string, number> = {};
  const scope = { organizationId };
  const linked = { organizationId, eventId: { not: null } } as const;

  // Invoicing, deepest first: a line, a discount, a tax, a schedule and a
  // balance all hang off an invoice, and receipts and refunds hang off the
  // payments that settled it.
  //
  // ONLY THE INVOICES AN EVENT OWNS. `Invoice.event` is optional - POST
  // /api/billing takes a request with no `eventId` - so a venue can raise one
  // against nothing in particular, and that is not an event's row to take with
  // it. The children are filtered through the same relation rather than by
  // organization, which is what stops this stripping the lines off a standalone
  // invoice that survives.
  const eventInvoice = {
    organizationId,
    invoice: { eventId: { not: null } }
  };

  deleted.invoiceLineItems = (
    await tx.invoiceLineItem.deleteMany({ where: eventInvoice })
  ).count;
  deleted.invoiceDiscounts = (
    await tx.invoiceDiscount.deleteMany({ where: eventInvoice })
  ).count;
  deleted.invoiceTaxes = (
    await tx.invoiceTax.deleteMany({ where: eventInvoice })
  ).count;
  deleted.invoicePaymentSchedules = (
    await tx.invoicePaymentSchedule.deleteMany({ where: eventInvoice })
  ).count;
  deleted.invoiceBalances = (
    await tx.invoiceBalance.deleteMany({ where: eventInvoice })
  ).count;

  // Receipts, refunds and transactions are event-linked by construction, so
  // these stay organization-wide: `PaymentTransaction.event` is required, and
  // both of the others hang off a required transaction. That `Restrict` is
  // also why the two go before it rather than after.
  deleted.paymentReceipts = (
    await tx.paymentReceipt.deleteMany({ where: scope })
  ).count;
  deleted.paymentRefunds = (
    await tx.paymentRefund.deleteMany({ where: scope })
  ).count;
  deleted.paymentTransactions = (
    await tx.paymentTransaction.deleteMany({ where: scope })
  ).count;
  deleted.invoices = (
    await tx.invoice.deleteMany({
      where: { organizationId, eventId: { not: null } }
    })
  ).count;

  // Documents and correspondence about an event. `GeneratedPdf.event` is a
  // required relation with no cascade, so this one is not optional cleanup -
  // the event delete below fails outright while a row survives here.
  deleted.generatedPdfs = (
    await tx.generatedPdf.deleteMany({ where: scope })
  ).count;
  deleted.emailLogs = (await tx.emailLog.deleteMany({ where: linked })).count;
  deleted.storedFiles = (
    await tx.storedFile.deleteMany({ where: linked })
  ).count;
  deleted.fileFolders = (
    await tx.fileFolder.deleteMany({ where: linked })
  ).count;
  deleted.activityLogs = (
    await tx.activityLog.deleteMany({ where: linked })
  ).count;

  // The kitchen's view of the event.
  deleted.kitchenNotifications = (
    await tx.kitchenNotification.deleteMany({ where: scope })
  ).count;
  deleted.kitchenItemStatuses = (
    await tx.kitchenItemStatus.deleteMany({ where: scope })
  ).count;

  // The menu as served, which is a copy of the library rather than the library.
  deleted.eventMenuLines = (
    await tx.eventMenuLine.deleteMany({ where: scope })
  ).count;
  deleted.eventMenus = (await tx.eventMenu.deleteMany({ where: scope })).count;

  deleted.diningPlans = (
    await tx.diningPlan.deleteMany({ where: scope })
  ).count;
  deleted.bookingReservations = (
    await tx.bookingReservation.deleteMany({ where: scope })
  ).count;
  deleted.events = (await tx.event.deleteMany({ where: scope })).count;

  return deleted;
}

/** The library an event's menu is built from, and the kitchen work raised against it. */
async function deleteMenuLibrary(tx: Tx, organizationId: string) {
  const deleted: Record<string, number> = {};
  const scope = { organizationId };

  // Kitchen-only events reference a menu, so they go before it.
  deleted.kitchenStandaloneItemStatuses = (
    await tx.kitchenStandaloneItemStatus.deleteMany({ where: scope })
  ).count;
  deleted.kitchenStandaloneEvents = (
    await tx.kitchenStandaloneEvent.deleteMany({ where: scope })
  ).count;

  deleted.menuItemServices = (
    await tx.menuItemService.deleteMany({ where: scope })
  ).count;
  deleted.addOns = (await tx.addOn.deleteMany({ where: scope })).count;
  deleted.eventPackages = (
    await tx.eventPackage.deleteMany({ where: scope })
  ).count;
  deleted.menuItems = (await tx.menuItem.deleteMany({ where: scope })).count;
  deleted.menuCategories = (
    await tx.menuCategory.deleteMany({ where: scope })
  ).count;
  deleted.tableclothOptions = (
    await tx.tableclothOption.deleteMany({ where: scope })
  ).count;

  return deleted;
}

/**
 * Configuration, roles and everybody's access but the caller's.
 *
 * The acting user keeps their membership, their principal and the grants on it;
 * everyone else's go. Roles themselves are deleted and re-materialized from
 * `starterRoles`, which is what "back to default" means for a tenant that has
 * authored roles of its own.
 */
async function resetAccessAndPreferences(
  tx: Tx,
  organizationId: string,
  actorUserId: string
) {
  const deleted: Record<string, number> = {};
  const scope = { organizationId };

  // A principal carries no user id of its own - the membership is what ties a
  // person to one, which is why this reads the seat rather than the subject.
  const actorMembership = await tx.organizationMembership.findFirst({
    where: { organizationId, userId: actorUserId },
    select: { principalId: true }
  });
  const actorPrincipalId = actorMembership?.principalId ?? null;

  // Grants first: they point at both roles and principals.
  deleted.principalPermissions = (
    await tx.principalPermission.deleteMany({ where: scope })
  ).count;
  deleted.principalRoles = (
    await tx.principalRole.deleteMany({ where: scope })
  ).count;
  deleted.serviceAccounts = (
    await tx.serviceAccount.deleteMany({ where: scope })
  ).count;
  deleted.principals = (
    await tx.principal.deleteMany({
      where: actorPrincipalId
        ? { organizationId, id: { not: actorPrincipalId } }
        : scope
    })
  ).count;
  deleted.roles = (await tx.role.deleteMany({ where: scope })).count;
  deleted.authorizationAudits = (
    await tx.authorizationAudit.deleteMany({ where: scope })
  ).count;

  // Everyone else's way in. The caller's own membership is the one row kept,
  // because a reset that locks the account out of itself cannot be undone from
  // inside the product.
  deleted.memberships = (
    await tx.organizationMembership.deleteMany({
      where: { organizationId, userId: { not: actorUserId } }
    })
  ).count;
  // Deactivated, not deleted. Two reasons, and the second is the stronger one:
  // a user row is named by twenty-odd columns across the schema - who changed a
  // dish, who confirmed a menu, who sent an email - several of them required, so
  // deleting people would either fail on a foreign key or blank out the history
  // that says who did what. Access is what a reset is for, and access is gone
  // with the membership and principal above.
  deleted.deactivatedUsers = (
    await tx.user.updateMany({
      where: { organizationId, id: { not: actorUserId }, isActive: true },
      data: { isActive: false }
    })
  ).count;

  // Preferences, which are absent-means-default everywhere they are read.
  deleted.organizationSettings = (
    await tx.organizationSetting.deleteMany({ where: scope })
  ).count;
  deleted.notificationPreferences = (
    await tx.notificationPreference.deleteMany({ where: scope })
  ).count;
  deleted.paymentSettings = (
    await tx.paymentSetting.deleteMany({ where: scope })
  ).count;

  await materializeStarterRoles(tx, organizationId, actorPrincipalId);

  return deleted;
}

/**
 * Puts the six starter roles back and returns the caller to Owner.
 *
 * The permission rows themselves are global catalog rows and are never touched -
 * only the organization's roles and the links between them.
 */
async function materializeStarterRoles(
  tx: Tx,
  organizationId: string,
  actorPrincipalId: string | null
) {
  // The same call sign-up makes, rather than a second copy of "what a starter
  // role is". A reset that rebuilt them by hand would drift from provisioning
  // the first time a role gained a key - and `isSystem`, the flag that stops
  // the role editor deleting them, is exactly the sort of detail a copy loses.
  const roleIds = await ensureStarterRoles(tx, organizationId);

  // Whoever ran the reset comes back as Owner. Without this the organization is
  // left with six roles and nobody in any of them - including the person
  // holding the screen, who would lose the account on their next request.
  //
  // The same constant sign-up uses for the person who created the organization,
  // and emphatically not `DEFAULT_MEMBERSHIP_ROLE_KEY` - that one names the
  // role somebody JOINING gets, so using it here would answer a reset by
  // demoting the account's owner to read-only with nobody left holding the keys
  // to promote them back. Naming the key at all is what INV-1 forbids in
  // application code, which is why it is imported rather than written here.
  const ownerRoleId = roleIds.get(FOUNDING_OWNER_ROLE_KEY);

  if (actorPrincipalId && ownerRoleId) {
    await assignRole(tx, {
      organizationId,
      principalId: actorPrincipalId,
      roleId: ownerRoleId
    });
  }
}

/** The venue itself, its records, and the history of working in it. */
async function deleteVenueAndRecords(tx: Tx, organizationId: string) {
  const deleted: Record<string, number> = {};
  const scope = { organizationId };

  deleted.hallMapPresets = (
    await tx.hallMapPreset.deleteMany({ where: scope })
  ).count;
  deleted.hallMapShapes = (
    await tx.hallMapShapeLibraryItem.deleteMany({ where: scope })
  ).count;
  deleted.halls = (await tx.hall.deleteMany({ where: scope })).count;
  deleted.eventTypes = (await tx.eventType.deleteMany({ where: scope })).count;
  deleted.holidayBlockedDates = (
    await tx.holidayBlockedDate.deleteMany({ where: scope })
  ).count;
  deleted.schoolCycles = (
    await tx.schoolCycle.deleteMany({ where: scope })
  ).count;
  deleted.memberShuls = (
    await tx.memberShul.deleteMany({ where: scope })
  ).count;
  deleted.todayNotes = (await tx.todayNote.deleteMany({ where: scope })).count;
  deleted.kitchenWorkers = (
    await tx.kitchenWorker.deleteMany({ where: scope })
  ).count;
  deleted.clients = (await tx.client.deleteMany({ where: scope })).count;
  deleted.vendors = (await tx.vendor.deleteMany({ where: scope })).count;

  // Whatever is left of these once the event-linked rows have gone: the
  // organization-level files, folders, mail and history.
  deleted.storedFilesRemaining = (
    await tx.storedFile.deleteMany({ where: scope })
  ).count;
  deleted.fileFoldersRemaining = (
    await tx.fileFolder.deleteMany({ where: scope })
  ).count;
  deleted.emailLogsRemaining = (
    await tx.emailLog.deleteMany({ where: scope })
  ).count;
  deleted.activityLogsRemaining = (
    await tx.activityLog.deleteMany({ where: scope })
  ).count;

  // The invoicing the event reset deliberately leaves alone: the ones raised
  // against no event at all, with their own lines, discounts, taxes, schedules
  // and balances. An account reset is where those go.
  deleted.invoiceLineItemsRemaining = (
    await tx.invoiceLineItem.deleteMany({ where: scope })
  ).count;
  deleted.invoiceDiscountsRemaining = (
    await tx.invoiceDiscount.deleteMany({ where: scope })
  ).count;
  deleted.invoiceTaxesRemaining = (
    await tx.invoiceTax.deleteMany({ where: scope })
  ).count;
  deleted.invoicePaymentSchedulesRemaining = (
    await tx.invoicePaymentSchedule.deleteMany({ where: scope })
  ).count;
  deleted.invoiceBalancesRemaining = (
    await tx.invoiceBalance.deleteMany({ where: scope })
  ).count;
  deleted.invoicesRemaining = (
    await tx.invoice.deleteMany({ where: scope })
  ).count;
  deleted.paymentWebhookEvents = (
    await tx.paymentProviderWebhookEvent.deleteMany({ where: scope })
  ).count;

  // Banking is configuration with a live connection behind it, so it goes with
  // the account rather than with the settings reset.
  deleted.bankTransactions = (
    await tx.bankTransaction.deleteMany({ where: scope })
  ).count;
  deleted.bankConnections = (
    await tx.bankConnection.deleteMany({ where: scope })
  ).count;

  return deleted;
}

export async function resetOrganization({
  organizationId,
  actorUserId,
  actorName,
  scope
}: {
  organizationId: string;
  actorUserId: string;
  /**
   * Snapshotted onto the entry below. `user_id` is ON DELETE SET NULL and the
   * account reset can take the actor's own user row with it, so the name is the
   * only thing that keeps "who emptied this" readable afterwards.
   */
  actorName?: string | null;
  scope: ResetScope;
}): Promise<ResetOutcome> {
  const deleted = await prisma.$transaction(
    async (tx) => {
      const counts: Record<string, number> = {};
      const record = (rows: Record<string, number>) =>
        Object.assign(counts, rows);

      if (scope !== "settings") {
        record(await deleteEventData(tx, organizationId));
      }

      if (scope === "events-and-menus" || scope === "full-account") {
        record(await deleteMenuLibrary(tx, organizationId));
      }

      if (scope === "full-account") {
        record(await deleteVenueAndRecords(tx, organizationId));
      }

      if (scope === "settings" || scope === "full-account") {
        record(
          await resetAccessAndPreferences(tx, organizationId, actorUserId)
        );
      }

      // Written last and deliberately after the history has been cleared: the
      // first thing in the new log says what emptied it and who asked for it.
      await recordActivity(
        tx,
        { organizationId, userId: actorUserId, actorName: actorName ?? null },
        {
          action: "organization.reset.performed",
          message: `${RESET_DESCRIPTIONS[scope].title} performed. ${Object.values(
            counts
          ).reduce((total, count) => total + count, 0)} records deleted.`,
          changed: { after: { scope, deleted: counts } }
        }
      );

      return counts;
    },
    // Emptying a busy organization is many statements over many tables; the
    // default 5s ceiling times out on a real account and leaves the reset
    // rolled back with no explanation the person can act on.
    { timeout: 120_000 }
  );

  return { scope, deleted };
}
