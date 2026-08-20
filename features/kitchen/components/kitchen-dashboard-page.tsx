"use client";

import { useMemo, useState } from "react";
import {
  AddKitchenEventDialog,
  type AddKitchenEventFormValues
} from "@/features/kitchen/forms/add-kitchen-event-dialog";
import { DashboardTopbar } from "@/components/layout/dashboard-topbar";
import { TodayNotesDrawer } from "@/components/shared/today-notes-drawer";
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

import { FourWeeksView } from "@/features/kitchen/components/kitchen-four-week-view";
import {
  KitchenEventDetailsDialog,
  type KitchenItemActionInput
} from "@/features/kitchen/components/kitchen-event-details-dialog";
import { KitchenHeader } from "@/features/kitchen/components/kitchen-header";
import { KitchenToolbar } from "@/features/kitchen/components/kitchen-toolbar";
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
  const kitchenQuery = useAuthenticatedQuery<KitchenResponse>("/api/kitchen");
  const kitchenMutation = useAuthenticatedMutation<
    KitchenItemActionInput,
    unknown
  >("/api/kitchen", "PATCH");
  const [activeView, setActiveView] = useState<KitchenView>("today");
  const today = useMemo(() => startOfDay(new Date()), []);
  const [anchorDate, setAnchorDate] = useState(today);
  const [workersOnly, setWorkersOnly] = useState(false);
  const [isAddKitchenEventOpen, setIsAddKitchenEventOpen] = useState(false);
  const [kitchenEventDateKey, setKitchenEventDateKey] = useState(() =>
    dateKey(today)
  );
  const [createdKitchenEvents, setCreatedKitchenEvents] = useState<
    Array<KitchenEvent & { dateKey: string }>
  >([]);
  const [selectedKitchenEvent, setSelectedKitchenEvent] =
    useState<KitchenEvent | null>(null);
  const [isTodayNotesOpen, setIsTodayNotesOpen] = useState(false);
  const days = useMemo<KitchenDay[]>(() => {
    const normalizedSearch = pageSearchQuery.trim().toLowerCase();
    const eventsByDate = new Map<string, KitchenEvent[]>();
    for (const event of kitchenQuery.data?.events ?? []) {
      const key = dateKeyFromIso(event.eventDate);
      const current = eventsByDate.get(key) ?? [];
      // `totalGuests` arrives worked out. The browser used to sum the head
      // counts itself and leave waiters out of a number it labelled "portions",
      // which is the same arithmetic the counting rules run - but only by
      // coincidence, in a second place, with nothing keeping the two in step.
      const kitchenEvent: KitchenEvent = {
        id: event.id,
        category: event.hall.name,
        title: `${event.clientName}${event.eventType ? ` ${event.eventType}` : ""}`,
        status: event.eventStatus,
        statusType: event.eventStatus.toLowerCase().includes("hold")
          ? "hold"
          : undefined,
        startsAt: event.startsAt,
        totalGuests: event.counts.totalGuests,
        menuStatus: event.menuStatus,
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

    for (const event of createdKitchenEvents) {
      const current = eventsByDate.get(event.dateKey) ?? [];
      current.push(event);
      eventsByDate.set(event.dateKey, current);
    }

    const start = activeView === "today" ? anchorDate : startOfWeek(anchorDate);
    const selectedDateKey = dateKey(anchorDate);
    const todayKey = dateKey(today);

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
        events: eventsByDate.get(key)
      };
    });
  }, [
    activeView,
    anchorDate,
    createdKitchenEvents,
    kitchenQuery.data,
    pageSearchQuery,
    today
  ]);

  const canAddKitchenEvent =
    kitchenQuery.data?.permissions.canAddKitchenEvents ?? false;

  const navigationStep =
    activeView === "today" ? 1 : activeView === "week" ? 7 : 28;

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

  function addKitchenEvent(values: AddKitchenEventFormValues) {
    if (!canAddKitchenEvent) return;

    setCreatedKitchenEvents((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        dateKey: kitchenEventDateKey,
        category: "Kitchen",
        title: values.eventName,
        statusType: "kitchen",
        startsAt: null,
        // The form's own validation guarantees a whole number of at least one.
        totalGuests: Number(values.portions),
        menuStatus: "Draft",
        // No menu document behind a hand-added event, so no production to be
        // part-way through. Still browser-only state, as it always was.
        summary: null
      }
    ]);
  }

  function openAddKitchenEvent(targetDateKey: string) {
    setKitchenEventDateKey(targetDateKey);
    setIsAddKitchenEventOpen(true);
  }

  async function saveKitchenItemAction(input: KitchenItemActionInput) {
    await kitchenMutation.mutate(input);
    // Both views of the same write: the board's cards carry the progress ratio,
    // and the open dialog - along with the event workspace's Kitchen tab - read
    // the per-event sheet. Refetching only the board would leave the row the
    // user just ticked showing its old status.
    invalidateAuthenticatedQuery(`/api/events/${input.eventId}/kitchen`);
    await kitchenQuery.refetch();
  }

  return (
    <div className="flex h-dvh min-h-0 w-full max-w-full flex-col overflow-hidden bg-[#f5f6f8] text-[#07162d]">
      {/* No actionsSlot - see the note in dashboard-shell. The topbar's own
          Today notes button already collapses to an icon below xl, which is
          what keeps it on the same line as the title on a phone. */}
      <DashboardTopbar
        title="Kitchen Dashboard"
        subtitle="Review kitchen events, production schedules, and assigned work."
        onTodayNotes={() => setIsTodayNotesOpen(true)}
        showNewBookingAction={false}
      />

      <div className="shrink-0 overflow-x-hidden">
        <KitchenHeader
          activeView={activeView}
          anchorDate={anchorDate}
          onChangeView={changeView}
          onNext={() => navigate(1)}
          onPrevious={() => navigate(-1)}
        />
      </div>

      <main className="flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-x-hidden overflow-y-auto p-2 sm:p-4">
        <KitchenToolbar
          canAddKitchenEvent={canAddKitchenEvent}
          onAddKitchenEvent={() => openAddKitchenEvent(dateKey(anchorDate))}
          onWorkersOnlyChange={setWorkersOnly}
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
        ) : (
          <div className="mt-4">
            {activeView === "today" ? (
              <TodayView
                canAddKitchenEvent={canAddKitchenEvent}
                day={days.find((day) => day.selected) ?? days[0]}
                onAddKitchenEvent={openAddKitchenEvent}
                onSelectEvent={setSelectedKitchenEvent}
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
                onCurrent={goToCurrentRange}
                onAddKitchenEvent={openAddKitchenEvent}
                onSelectEvent={setSelectedKitchenEvent}
                onNext={() => navigate(1)}
                onPrevious={() => navigate(-1)}
              />
            )}
          </div>
        )}
      </main>

      <AddKitchenEventDialog
        canSave={canAddKitchenEvent}
        date={kitchenEventDateKey}
        onClose={() => setIsAddKitchenEventOpen(false)}
        onSave={addKitchenEvent}
        open={isAddKitchenEventOpen}
      />

      <TodayNotesDrawer
        onClose={() => setIsTodayNotesOpen(false)}
        open={isTodayNotesOpen}
      />

      <KitchenEventDetailsDialog
        event={selectedKitchenEvent}
        isSaving={kitchenMutation.isPending}
        onClose={() => setSelectedKitchenEvent(null)}
        onSaveItemAction={saveKitchenItemAction}
        permissions={
          kitchenQuery.data?.permissions ?? {
            canAddKitchenEvents: false,
            canAssignWorkers: false,
            canUpdateKitchenStatus: false
          }
        }
        workers={kitchenQuery.data?.workers ?? []}
      />
    </div>
  );
}
