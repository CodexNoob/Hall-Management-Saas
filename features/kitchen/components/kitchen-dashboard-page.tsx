"use client";

import { useMemo, useState } from "react";
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
  const [activeView, setActiveView] = useState<KitchenView>("today");
  const today = useMemo(() => startOfDay(new Date()), []);
  const [anchorDate, setAnchorDate] = useState(today);
  const rangeStart =
    activeView === "today" ? anchorDate : startOfWeek(anchorDate);
  const kitchenQueryUrl = `/api/kitchen?start=${dateKey(rangeStart)}`;
  const kitchenQuery = useAuthenticatedQuery<KitchenResponse>(kitchenQueryUrl);
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
  const [isTodayNotesOpen, setIsTodayNotesOpen] = useState(false);
  const [acknowledgingNotificationId, setAcknowledgingNotificationId] =
    useState<string | null>(null);
  const [notificationBulkAction, setNotificationBulkAction] = useState<
    "acknowledge-all" | "clear" | null
  >(null);
  const [acknowledgmentError, setAcknowledgmentError] = useState<string | null>(
    null
  );

  const days = useMemo<KitchenDay[]>(() => {
    const normalizedSearch = pageSearchQuery.trim().toLowerCase();
    const eventsByDate = new Map<string, KitchenEvent[]>();
    const todayKey = dateKey(today);
    const currentWorkerId = kitchenQuery.data?.currentWorkerId ?? null;
    const visibleAssignedCount = (
      summary: KitchenEvent["summary"] | undefined | null
    ) =>
      currentWorkerId
        ? (summary?.assignedToCurrentWorker ?? 0)
        : (summary?.assigned ?? 0);

    for (const event of kitchenQuery.data?.events ?? []) {
      if (workersOnly && visibleAssignedCount(event.summary) === 0) continue;

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
        status: event.eventStatus,
        statusType: event.eventStatus.toLowerCase().includes("hold")
          ? "hold"
          : undefined,
        startsAt: event.startsAt,
        totalGuests: event.counts.totalGuests,
        menuStatus: event.menuStatus,
        otherMeals: event.otherMeals,
        summary: event.summary
      };
      if (
        !normalizedSearch ||
        [
          kitchenEvent.title,
          kitchenEvent.category,
          event.packageName ?? "",
          kitchenEvent.status
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch)
      ) {
        current.push(kitchenEvent);
      }
      eventsByDate.set(key, current);
    }

    for (const event of kitchenQuery.data?.kitchenEvents ?? []) {
      if (workersOnly && visibleAssignedCount(event.summary) === 0) continue;

      const current = eventsByDate.get(event.dateKey) ?? [];
      current.push({ ...event, past: event.dateKey < todayKey });
      eventsByDate.set(event.dateKey, current);
    }

    const start = activeView === "today" ? anchorDate : startOfWeek(anchorDate);
    const selectedDateKey = dateKey(anchorDate);

    return Array.from({ length: 28 }, (_, index) => {
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
  }, [
    activeView,
    anchorDate,
    kitchenQuery.data,
    pageSearchQuery,
    today,
    workersOnly
  ]);

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
    seesWholeBoard: true
  };
  const selectedEventPermissions = selectedKitchenEvent?.past
    ? {
        ...detailsPermissions,
        canAssignWorkers: false,
        canUpdateKitchenStatus: false
      }
    : detailsPermissions;

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
    setActiveView(view);
    if (view === "today") setAnchorDate(today);
  }

  function goToCurrentRange() {
    setAnchorDate(today);
  }

  async function addKitchenEvent(values: AddKitchenEventFormValues) {
    if (!canAddKitchenEvent) return;

    const isQuickMenu = Boolean(
      values.quickMenuName &&
      (values.quickMenuDishes || values.quickMenuItemIds.length > 0)
    );

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
    if (input.action === "replace-menu-item") {
      invalidateAuthenticatedQuery(`/api/events/${input.eventId}/menu`);
    }

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
        event={selectedKitchenEvent}
        isSaving={kitchenMutation.isPending}
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
