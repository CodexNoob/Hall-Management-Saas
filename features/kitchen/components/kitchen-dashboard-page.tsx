"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AddKitchenEventDialog,
  type AddKitchenEventFormValues
} from "@/features/kitchen/forms/add-kitchen-event-dialog";
import { AsyncState } from "@/components/ui/async-state";
import {
  addDays,
  dateKey,
  dateKeyFromIso,
  startOfDay,
  startOfWeek
} from "@/lib/dates/calendar-date";
import { useAuthenticatedMutation } from "@/features/dashboard/hooks/use-authenticated-mutation";
import {
  invalidateAuthenticatedQuery,
  invalidateAuthenticatedQueryPrefix,
  useAuthenticatedQuery
} from "@/features/dashboard/hooks/use-authenticated-query";
import { useDashboardPageSearch } from "@/features/dashboard/hooks/use-dashboard-page-search";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";

import { FourWeeksView } from "@/features/kitchen/components/kitchen-four-week-view";
import {
  KitchenEventDetailsDialog,
  type KitchenItemActionInput
} from "@/features/kitchen/components/kitchen-event-details-dialog";
import { KitchenHeader } from "@/features/kitchen/components/kitchen-header";
import { KitchenNotificationsDrawer } from "@/features/kitchen/components/kitchen-notifications-drawer";
import { KitchenToolbar } from "@/features/kitchen/components/kitchen-toolbar";
import { ManageWorkersDialog } from "@/features/kitchen/forms/manage-workers-dialog";
import { TodayView } from "@/features/kitchen/components/kitchen-today-view";
import { WeekView } from "@/features/kitchen/components/kitchen-week-view";
import {
  dayNames,
  type KitchenDay,
  type KitchenEvent,
  type KitchenResponse,
  type KitchenView
} from "@/features/kitchen/components/kitchen-shared";
export function KitchenDashboardPage() {
  const [pageSearchQuery] = useDashboardPageSearch("Kitchen");
  /*
   * Null until the range tabs are used, and only then does it win.
   *
   * The view a visit opens on is Settings > Kitchen > Default view, which
   * arrives with the board data rather than being known at mount. Holding an
   * override instead of seeding state from the response is what lets the
   * setting apply the moment it lands without an effect racing the first paint,
   * and without the board undoing a tab the cook has just pressed.
   */
  const [activeViewOverride, setActiveViewOverride] =
    useState<KitchenView | null>(null);
  /*
   * Which day it is, kept current while the board is open.
   *
   * This was worked out once at mount. A kitchen board is left up - on a wall,
   * on a pass, through service - so at midnight it went on calling yesterday
   * "Today", left yesterday's cards unmarked as past, and let a job be added to
   * a date that had already gone.
   *
   * The identity is held steady while the date is unchanged, because the whole
   * board is derived from it: returning a fresh object each minute would
   * rebuild every day and card for nothing.
   */
  const [today, setToday] = useState(() => startOfDay(new Date()));
  const [anchorDate, setAnchorDate] = useState(today);

  useEffect(() => {
    const timer = setInterval(() => {
      const current = startOfDay(new Date());

      setToday((previous) => {
        if (dateKey(previous) === dateKey(current)) return previous;

        // A board nobody has navigated away from follows the date over. One
        // parked on another week is left where it was put - the day rolling
        // over is not a reason to move somebody off what they were reading.
        setAnchorDate((anchor) =>
          dateKey(anchor) === dateKey(previous) ? current : anchor
        );

        return current;
      });
    }, 60_000);

    return () => clearInterval(timer);
  }, []);
  // One window for all three views: it opens on the anchor's week and runs 28
  // days, so Today, This Week and 4 Weeks all sit inside it. Measuring it per
  // view is what would make the request depend on a setting that arrives in the
  // response - refetching the board the moment that setting landed - and it
  // also spares a refetch on every tab press.
  const rangeStart = startOfWeek(anchorDate);
  const kitchenQueryUrl = `/api/kitchen?start=${dateKey(rangeStart)}`;
  const kitchenQuery = useAuthenticatedQuery<KitchenResponse>(kitchenQueryUrl);
  const activeView =
    activeViewOverride ??
    kitchenQuery.data?.kitchenSettings?.defaultView ??
    "today";
  const kitchenMutation = useAuthenticatedMutation<
    KitchenItemActionInput,
    unknown
  >("/api/kitchen", "PATCH");
  const addKitchenEventMutation = useAuthenticatedMutation<
    {
      date: string;
      menuId?: string;
      quickMenu?: {
        name: string;
        dishNames: string[];
        menuItemIds: string[];
        saveToLibrary: boolean;
      };
      addOnIds: string[];
      portions: number;
      kitchenNote?: string;
    },
    { kitchenEvent: KitchenEvent & { dateKey: string } }
  >("/api/kitchen", "POST");
  const [workersOnly, setWorkersOnly] = useState(false);
  const [isAddKitchenEventOpen, setIsAddKitchenEventOpen] = useState(false);
  const [isManageWorkersOpen, setIsManageWorkersOpen] = useState(false);
  const [kitchenEventDateKey, setKitchenEventDateKey] = useState(() =>
    dateKey(today)
  );
  const [selectedKitchenEvent, setSelectedKitchenEvent] =
    useState<KitchenEvent | null>(null);
  // The cancel goes through its own fetch rather than `kitchenMutation`, so it
  // needs its own pending flag - without one the dialog stayed fully live while
  // the booking was being ended.
  const [isCancellingEvent, setIsCancellingEvent] = useState(false);
  const [isTodayNotesOpen, setIsTodayNotesOpen] = useState(false);
  const [acknowledgingNotificationId, setAcknowledgingNotificationId] =
    useState<string | null>(null);
  const [notificationBulkAction, setNotificationBulkAction] = useState<
    "acknowledge-all" | "clear" | null
  >(null);
  const [acknowledgmentError, setAcknowledgmentError] = useState<string | null>(
    null
  );

  /*
   * The board's days, and every event on it keyed by id.
   *
   * The index is built before the filters rather than read back out of `days`
   * afterwards, because `days` is what search and workers-only have already
   * narrowed. An open dialog looks its event up here, so typing in the search
   * box while it is open no longer leaves it frozen on the copy it opened with.
   */
  const { days, eventsById } = useMemo(() => {
    const normalizedSearch = pageSearchQuery.trim().toLowerCase();
    const eventsByDate = new Map<string, KitchenEvent[]>();
    const eventsById = new Map<string, KitchenEvent>();
    const todayKey = dateKey(today);
    const currentWorkerId = kitchenQuery.data?.currentWorkerId ?? null;
    const visibleAssignedCount = (
      summary: KitchenEvent["summary"] | undefined | null
    ) =>
      currentWorkerId
        ? (summary?.assignedToCurrentWorker ?? 0)
        : (summary?.assigned ?? 0);
    /*
     * One matcher for both kinds of card.
     *
     * The search used to be applied to bookings only, so narrowing the board
     * left every hand-added kitchen job sitting there - a search that hides
     * some of what does not match and none of the rest reads as a broken
     * search rather than a filtered board.
     */
    const matchesSearch = (fields: Array<string | null | undefined>) =>
      !normalizedSearch ||
      fields
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);

    for (const event of kitchenQuery.data?.events ?? []) {
      const key = dateKeyFromIso(event.eventDate);
      const current = eventsByDate.get(key) ?? [];
      // `totalGuests` arrives worked out. The browser used to sum the head
      // counts itself and leave waiters out of a number it labelled "portions",
      // which is the same arithmetic the counting rules run - but only by
      // coincidence, in a second place, with nothing keeping the two in step.
      const kitchenEvent: KitchenEvent = {
        id: event.id,
        dateKey: key,
        past: key < todayKey,
        source: "booking",
        category: event.hall.name,
        title: `${event.clientName}${event.eventType ? ` ${event.eventType}` : ""}`,
        clientName: event.clientName,
        eventType: event.eventType,
        status: event.eventStatus,
        statusType: event.eventStatus.toLowerCase().includes("hold")
          ? "hold"
          : undefined,
        startsAt: event.startsAt,
        totalGuests: event.counts.totalGuests,
        menuStatus: event.menuStatus,
        otherMeals: event.otherMeals,
        summary: event.summary,
        sheet: event.sheet,
        version: event.version
      };

      eventsById.set(kitchenEvent.id, kitchenEvent);

      if (workersOnly && visibleAssignedCount(event.summary) === 0) continue;

      if (
        matchesSearch([
          kitchenEvent.title,
          kitchenEvent.category,
          event.packageName,
          kitchenEvent.status
        ])
      ) {
        current.push(kitchenEvent);
      }
      eventsByDate.set(key, current);
    }

    for (const event of kitchenQuery.data?.kitchenEvents ?? []) {
      const standaloneEvent = { ...event, past: event.dateKey < todayKey };

      eventsById.set(standaloneEvent.id, standaloneEvent);

      if (workersOnly && visibleAssignedCount(event.summary) === 0) continue;

      const current = eventsByDate.get(event.dateKey) ?? [];

      // The kitchen note as well as the name: a standalone job is often
      // identified by what it is for rather than by what the menu is called.
      if (
        matchesSearch([
          event.title,
          event.category,
          event.kitchenNote,
          event.menuStatus
        ])
      ) {
        current.push(standaloneEvent);
      }

      eventsByDate.set(event.dateKey, current);
    }

    // The same 28 days the request covers, whichever view is on: Today reads
    // the selected day out of them, This Week the first seven, 4 Weeks all of
    // them. Building a different list per view is how a day could end up drawn
    // from outside the range that was fetched.
    const start = startOfWeek(anchorDate);
    const selectedDateKey = dateKey(anchorDate);

    const days: KitchenDay[] = Array.from({ length: 28 }, (_, index) => {
      const date = addDays(start, index);
      const key = dateKey(date);
      const isSelectedDate = key === selectedDateKey;

      return {
        dateKey: key,
        dayName: key === todayKey ? "Today" : dayNames[date.getDay()],
        dateLabel: new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric"
        }).format(date),
        dayNumber: date.getDate(),
        shabbos: date.getDay() === 6,
        selected: isSelectedDate,
        today: key === todayKey,
        past: key < todayKey,
        events: eventsByDate.get(key)
      };
    });

    return { days, eventsById };
  }, [anchorDate, kitchenQuery.data, pageSearchQuery, today, workersOnly]);

  const canAddKitchenEvent =
    kitchenQuery.data?.permissions.canAddKitchenEvents ?? false;
  const canAddOnSelectedDate =
    canAddKitchenEvent && dateKey(anchorDate) >= dateKey(today);
  // The same permission that gates assigning a dish. Whoever decides who cooks
  // what keeps the list of who there is to ask.
  const canManageWorkers =
    kitchenQuery.data?.permissions.canAssignWorkers ?? false;
  // Whether the server sent the whole kitchen or only this cook's own dishes.
  // Optimistic until the first response: assuming "scoped" would flash "nothing
  // assigned to you" at a manager on every load.
  const seesWholeBoard = kitchenQuery.data?.permissions.seesWholeBoard ?? true;
  const detailsPermissions = kitchenQuery.data?.permissions ?? {
    canAddKitchenEvents: false,
    canAssignWorkers: false,
    canUpdateKitchenStatus: false,
    canCancelEvents: false,
    seesWholeBoard: true
  };
  const selectedEventPermissions = selectedKitchenEvent?.past
    ? {
        ...detailsPermissions,
        canAssignWorkers: false,
        canUpdateKitchenStatus: false
      }
    : detailsPermissions;
  const currentSelectedKitchenEvent = selectedKitchenEvent
    ? (eventsById.get(selectedKitchenEvent.id) ?? selectedKitchenEvent)
    : null;

  const navigationStep =
    activeView === "today" ? 1 : activeView === "week" ? 7 : 28;

  // Whether the board is already pointed at the range containing today, which
  // is what decides whether the header offers a way back to it. Navigation
  // always moves in whole steps from today, so comparing the range start is
  // exact rather than approximate.
  const isOnToday =
    activeView === "today"
      ? dateKey(anchorDate) === dateKey(today)
      : dateKey(startOfWeek(anchorDate)) === dateKey(startOfWeek(today));

  function navigate(amount: number) {
    setAnchorDate((current) => addDays(current, amount * navigationStep));
  }

  function changeView(view: KitchenView) {
    setActiveViewOverride(view);
    if (view === "today") setAnchorDate(today);
  }

  function goToCurrentRange() {
    setAnchorDate(today);
  }

  async function addKitchenEvent(values: AddKitchenEventFormValues) {
    if (!canAddKitchenEvent) return;

    const isQuickMenu = !values.menuId;

    await addKitchenEventMutation.mutate({
      date: kitchenEventDateKey,
      ...(isQuickMenu
        ? {
            quickMenu: {
              name: values.quickMenuName,
              dishNames: values.quickMenuDishes
                .split(/\r?\n/)
                .map((dish) => dish.trim())
                .filter(Boolean),
              menuItemIds: values.quickMenuItemIds,
              saveToLibrary: values.saveQuickMenuToLibrary
            }
          }
        : { menuId: values.menuId }),
      addOnIds: values.addOnIds,
      portions: Number(values.portions),
      kitchenNote: values.kitchenNote || undefined
    });
    await kitchenQuery.refetch();
  }

  function openAddKitchenEvent(targetDateKey: string) {
    if (targetDateKey < dateKey(today)) return;
    setKitchenEventDateKey(targetDateKey);
    setIsAddKitchenEventOpen(true);
  }

  async function acknowledgeKitchenNotification(notificationId: string) {
    setAcknowledgingNotificationId(notificationId);
    setAcknowledgmentError(null);
    try {
      const response = await authenticatedFetch(
        `/api/kitchen/notifications/${notificationId}`,
        { method: "PATCH" }
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          payload?.error ?? "Could not acknowledge notification."
        );
      }

      await kitchenQuery.refetch();
    } catch (error) {
      setAcknowledgmentError(
        error instanceof Error
          ? error.message
          : "Could not acknowledge notification."
      );
    } finally {
      setAcknowledgingNotificationId(null);
    }
  }

  async function runNotificationBulkAction(
    action: "acknowledge-all" | "clear"
  ) {
    setNotificationBulkAction(action);
    setAcknowledgmentError(null);
    try {
      const response = await authenticatedFetch("/api/kitchen/notifications", {
        method: action === "acknowledge-all" ? "PATCH" : "DELETE"
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          payload?.error ??
            (action === "acknowledge-all"
              ? "Could not acknowledge all notifications."
              : "Could not clear notifications.")
        );
      }
      await kitchenQuery.refetch();
    } catch (error) {
      setAcknowledgmentError(
        error instanceof Error
          ? error.message
          : "Could not update notifications."
      );
    } finally {
      setNotificationBulkAction(null);
    }
  }

  async function saveKitchenItemAction(input: KitchenItemActionInput) {
    await kitchenMutation.mutate(input);
    if (
      input.action === "standalone-status" ||
      input.action === "standalone-reset-status" ||
      input.action === "standalone-assign-worker"
    ) {
      await kitchenQuery.refetch();
      return;
    }

    // Both views of the same write: the board's cards carry the progress ratio,
    // and the open dialog - along with the event workspace's Kitchen tab - read
    // the per-event sheet. Refetching only the board would leave the row the
    // user just ticked showing its old status.
    invalidateAuthenticatedQuery(`/api/events/${input.eventId}/kitchen`);

    // A swap is the one action here that rewrites the menu itself, which the
    // event workspace's Menu tab reads through a route of its own - and answers
    // from cache for two minutes, so without this it would go on offering the
    // dish the kitchen has just taken off.
    if (
      input.action === "replace-menu-item" ||
      input.action === "replace-add-on"
    ) {
      invalidateAuthenticatedQuery(`/api/events/${input.eventId}/menu`);
    }

    await kitchenQuery.refetch();
  }

  /**
   * Cancels the booking behind a card, through the same lifecycle route the
   * event workspace uses.
   *
   * Cancelled, not deleted: the booking leaves this board and the calendar and
   * keeps every record attached to it. `expectedVersion` is the version the
   * board read, so a booking somebody else has changed in the meantime is
   * refused rather than overwritten - the dialog surfaces the refusal.
   */
  /**
   * Takes an event off the board, by whichever route its kind allows.
   *
   * A booking is cancelled and keeps everything it carries. A standalone
   * kitchen job is deleted: it has no client, no invoice and no calendar
   * entry, so there is nothing a cancellation would preserve and nothing left
   * for the row to mean.
   */
  async function removeEvent(kitchenEvent: KitchenEvent) {
    setIsCancellingEvent(true);

    try {
      if (kitchenEvent.source === "standalone") {
        await sendStandaloneDelete(kitchenEvent);
      } else {
        await sendCancel(kitchenEvent);
      }
    } finally {
      setIsCancellingEvent(false);
    }
  }

  async function sendStandaloneDelete(kitchenEvent: KitchenEvent) {
    const response = await authenticatedFetch(
      `/api/kitchen?kitchenEventId=${encodeURIComponent(kitchenEvent.id)}`,
      { method: "DELETE" }
    );

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      throw new Error(payload?.error ?? "Could not delete this kitchen event.");
    }

    // Only the board holds these: a standalone job appears on no other screen,
    // so there is nothing else to invalidate.
    await kitchenQuery.refetch();
  }

  async function sendCancel(kitchenEvent: KitchenEvent) {
    const response = await authenticatedFetch(
      `/api/events/${kitchenEvent.id}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "CANCELLED",
          expectedVersion: kitchenEvent.version
        })
      }
    );

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      throw new Error(payload?.error ?? "Could not cancel this event.");
    }

    /*
     * A cancellation is not only the kitchen's news.
     *
     * The booking leaves the calendar's grid and availability, the event list
     * and the dashboard's schedule as well, and each of those answers from
     * cache for two minutes - so refetching this board alone would leave the
     * cancelled event sitting on every other screen until something happened to
     * reload it. By prefix, because the calendar and dashboard carry their date
     * range in the query string and this has no way to know which range anybody
     * is looking at.
     */
    invalidateAuthenticatedQueryPrefix("/api/calendar");
    invalidateAuthenticatedQueryPrefix("/api/events");
    invalidateAuthenticatedQueryPrefix("/api/dashboard");

    await kitchenQuery.refetch();
  }

  return (
    <div className="flex h-dvh min-h-0 w-full max-w-full flex-col overflow-hidden bg-[#a8a8a6] text-[#061126]">
      <div className="shrink-0 overflow-x-hidden">
        <KitchenHeader
          activeView={activeView}
          anchorDate={anchorDate}
          isOnToday={isOnToday}
          onChangeView={changeView}
          onNext={() => navigate(1)}
          onPrevious={() => navigate(-1)}
          onToday={goToCurrentRange}
          onTodayNotes={() => setIsTodayNotesOpen(true)}
          notificationCount={
            kitchenQuery.data?.notifications.filter(
              (notification) => !notification.acknowledged
            ).length ?? 0
          }
          today={today}
        />
      </div>

      <main className="flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-x-hidden overflow-y-auto px-3 py-3 sm:px-4">
        <div className="flex w-full min-w-0 flex-1 flex-col gap-3">
          <KitchenToolbar
            canAddKitchenEvent={canAddOnSelectedDate}
            canManageWorkers={canManageWorkers}
            onAddKitchenEvent={() => openAddKitchenEvent(dateKey(anchorDate))}
            onManageWorkers={() => setIsManageWorkersOpen(true)}
            onWorkersOnlyChange={setWorkersOnly}
            // Withheld from a scoped cook, for whom it is a no-op: the server
            // already sent only their dishes, so the box would filter a list
            // that is nothing else, and leaving it on screen implies they are
            // choosing something they are not.
            showWorkersOnly={seesWholeBoard}
            workersOnly={workersOnly}
          />

          {kitchenQuery.isLoading || kitchenQuery.error ? (
            <div className="flex min-h-80 flex-1 items-center justify-center">
              <AsyncState
                error={kitchenQuery.error}
                isLoading={kitchenQuery.isLoading}
                onRetry={kitchenQuery.refetch}
              />
            </div>
          ) : activeView === "today" ? (
            <TodayView
              day={days.find((day) => day.selected) ?? days[0]}
              onSelectEvent={setSelectedKitchenEvent}
              seesWholeBoard={seesWholeBoard}
            />
          ) : activeView === "week" ? (
            <WeekView
              canAddKitchenEvent={canAddKitchenEvent}
              days={days.slice(0, 7)}
              onAddKitchenEvent={openAddKitchenEvent}
              onSelectEvent={setSelectedKitchenEvent}
            />
          ) : (
            <FourWeeksView
              canAddKitchenEvent={canAddKitchenEvent}
              days={days}
              onAddKitchenEvent={openAddKitchenEvent}
              onSelectEvent={setSelectedKitchenEvent}
            />
          )}
        </div>
      </main>

      <AddKitchenEventDialog
        addOns={kitchenQuery.data?.addOns ?? []}
        canSave={canAddKitchenEvent}
        date={kitchenEventDateKey}
        menuItems={kitchenQuery.data?.menuItems ?? []}
        menus={kitchenQuery.data?.menus ?? []}
        onClose={() => setIsAddKitchenEventOpen(false)}
        onSave={addKitchenEvent}
        open={isAddKitchenEventOpen}
      />

      <KitchenNotificationsDrawer
        acknowledgmentError={acknowledgmentError}
        acknowledgingId={acknowledgingNotificationId}
        bulkAction={notificationBulkAction}
        hasMoreNotifications={
          kitchenQuery.data?.notificationsHasMore ?? false
        }
        // The same signal the server scopes the feed and gates the bulk
        // endpoints on: a cook is sent only the notifications for events they
        // are cooking on, so the drawer is shaped for that rather than for a
        // supervisor's ledger.
        seesWholeKitchen={seesWholeBoard}
        notifications={kitchenQuery.data?.notifications ?? []}
        onAcknowledge={acknowledgeKitchenNotification}
        onAcknowledgeAll={() => runNotificationBulkAction("acknowledge-all")}
        onClearNotifications={() => runNotificationBulkAction("clear")}
        onClose={() => {
          setIsTodayNotesOpen(false);
          setAcknowledgmentError(null);
        }}
        open={isTodayNotesOpen}
      />

      <ManageWorkersDialog
        canManage={canManageWorkers}
        onClose={() => setIsManageWorkersOpen(false)}
        open={isManageWorkersOpen}
      />

      <KitchenEventDetailsDialog
        event={currentSelectedKitchenEvent}
        isSaving={kitchenMutation.isPending || isCancellingEvent}
        onRemoveEvent={
          /*
           * Two different permissions, because these are two different acts.
           *
           * Cancelling a booking ends it for the whole business, so it asks the
           * booking lifecycle's own `event.status.update` - and needs the
           * version, because the status route refuses a write that cannot name
           * one. Deleting a standalone job only takes work off this board, so
           * whoever may add one may remove it.
           */
          currentSelectedKitchenEvent
            ? currentSelectedKitchenEvent.source === "standalone"
              ? canAddKitchenEvent
                ? () => removeEvent(currentSelectedKitchenEvent)
                : undefined
              : detailsPermissions.canCancelEvents &&
                  currentSelectedKitchenEvent.version !== undefined
                ? () => removeEvent(currentSelectedKitchenEvent)
                : undefined
            : undefined
        }
        onClose={() => setSelectedKitchenEvent(null)}
        onSaveItemAction={saveKitchenItemAction}
        permissions={selectedEventPermissions}
        workersOnly={workersOnly}
        currentWorkerId={kitchenQuery.data?.currentWorkerId ?? null}
        workers={kitchenQuery.data?.workers ?? []}
      />
    </div>
  );
}
