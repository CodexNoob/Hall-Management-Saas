"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardTopbar } from "@/components/layout/dashboard-topbar";
import { DashboardPageState } from "@/components/layout/dashboard-page-state";
import { TodayNotesDrawer } from "@/components/shared/today-notes-drawer";
import { useAuthenticatedQuery } from "@/features/dashboard/hooks/use-authenticated-query";
import { useDashboardPageSearch } from "@/features/dashboard/hooks/use-dashboard-page-search";

import { EventListCard } from "@/features/events/components/event-list-panel";
import { EventWorkspace } from "@/features/events/components/event-workspace";
import {
  LineIcon,
  type EventFile,
  type EventsResponse
} from "@/features/events/components/event-manager-shared";
export function EventManagerPage() {
  const [pageSearchQuery, setPageSearchQuery] =
    useDashboardPageSearch("Event Manager");
  // Read once, on the way in: this decides the first selection only, so that a
  // later click in the list is not snapped back to whatever the link said.
  const [deepLinkEventId] = useState(() =>
    typeof window === "undefined"
      ? ""
      : (new URLSearchParams(window.location.search).get("eventId") ?? "")
  );
  const eventsQuery = useAuthenticatedQuery<EventsResponse>(
    // The list is capped and ordered by start time, so an event can easily sit
    // outside it. Asking for it by id is what keeps a deep link honest.
    deepLinkEventId
      ? `/api/events?eventId=${encodeURIComponent(deepLinkEventId)}`
      : "/api/events"
  );
  const [selectedEventId, setSelectedEventId] = useState("");
  const [eventStatusFilter, setEventStatusFilter] = useState("All events");
  const [eventLifecycleFilter, setEventLifecycleFilter] = useState("Active");
  const [roomFilter, setRoomFilter] = useState("All rooms");
  const [isEventListExpanded, setIsEventListExpanded] = useState(true);
  const [isTodayNotesOpen, setIsTodayNotesOpen] = useState(false);
  const allEvents = useMemo<EventFile[]>(
    () =>
      (eventsQuery.data?.events ?? []).map((event) => {
        const date = new Date(event.eventDate);
        const startsAt = event.startsAt ? new Date(event.startsAt) : null;
        const guestCount =
          event.couplesCount * 2 +
          event.menCount +
          event.ladiesCount +
          event.boysCount +
          event.girlsCount +
          event.kidsCount;

        return {
          id: event.id,
          bookingStatus: event.bookingStatus,
          clientName: event.clientName,
          eventType: event.eventType ?? "",
          title: `${event.clientName}${event.eventType ? ` ${event.eventType}` : ""}`,
          date: new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            timeZone: "UTC"
          }).format(date),
          dateInput: date.toISOString().slice(0, 10),
          time: startsAt
            ? new Intl.DateTimeFormat("en-US", {
                hour: "numeric",
                minute: "2-digit"
              }).format(startsAt)
            : "Time not set",
          timeInput: startsAt
            ? `${String(startsAt.getHours()).padStart(2, "0")}:${String(
                startsAt.getMinutes()
              ).padStart(2, "0")}`
            : "",
          hallId: event.hall.id,
          room: event.hall.name,
          packageName: event.packageName ?? "Not assigned",
          guests: String(guestCount),
          children: String(
            event.kidsCount + event.boysCount + event.girlsCount
          ),
          couples: String(event.couplesCount),
          coordinator: "Unassigned",
          balance:
            event.paymentStatus === "Paid in Full" ? "Paid" : "See billing",
          status: event.eventStatus.toLowerCase().includes("confirm")
            ? "Confirmed"
            : "Hold",
          paymentStatus: event.paymentStatus ?? "No invoice",
          version: event.version,
          cancelledAt: event.cancelledAt,
          completedAt: event.completedAt,
          waitersCount: event.waitersCount,
          setupTime: event.setupTime ?? "",
          washingTime: event.washingTime ?? "",
          tableclothName: event.tableclothName ?? "",
          notes: event.notes ? [event.notes] : [],
          internalNotes: event.notes ?? "",
          daveningNote: event.daveningNote ?? "",
          memberShulName: event.memberShulName ?? "",
          sideBoxes: typeof event.sideBoxes === "string" ? event.sideBoxes : "",
          shabbosSetup:
            typeof event.shabbosSetup === "string" ? event.shabbosSetup : "",
          diningManagerNotes: event.diningManagerNotes,
          activityLogs: event.activityLogs ?? [],
          diningHallMapPreset: event.diningHallMapPreset,
          phone: event.phone,
          email: event.email ?? "",
          workspaceData: event.workspaceData ?? {},
          menuItemIds: event.menuItemIds
        };
      }),
    [eventsQuery.data]
  );

  const deepLinkEvent = deepLinkEventId
    ? allEvents.find((event) => event.id === deepLinkEventId)
    : undefined;
  // The link named an event this organization does not have, or one this user
  // may not see. Said out loud below, rather than answered with a different
  // event that the page would then present as the one that was asked for.
  const isDeepLinkMissing =
    Boolean(deepLinkEventId) && !eventsQuery.isLoading && !deepLinkEvent;

  useEffect(() => {
    if (allEvents.length === 0) return;
    const nextSelectedEvent =
      allEvents.find((event) => event.id === selectedEventId) ??
      deepLinkEvent ??
      allEvents[0];

    if (nextSelectedEvent.id !== selectedEventId) {
      setSelectedEventId(nextSelectedEvent.id);
    }
  }, [allEvents, deepLinkEvent, selectedEventId]);

  if (eventsQuery.isLoading) {
    return (
      <DashboardPageState
        isLoading
        showNewBookingAction={false}
        subtitle="Select an event, then manage every connected section from one workspace."
        title="Event Manager"
      />
    );
  }

  if (eventsQuery.error || allEvents.length === 0) {
    return (
      <DashboardPageState
        emptyMessage="Create an event to start using the event workspace."
        emptyTitle="No events yet"
        error={eventsQuery.error}
        isEmpty={!eventsQuery.error}
        onRetry={eventsQuery.refetch}
        showNewBookingAction={false}
        subtitle="Select an event, then manage every connected section from one workspace."
        title="Event Manager"
      />
    );
  }

  if (isDeepLinkMissing) {
    return (
      <DashboardPageState
        emptyMessage="It may have been deleted, or it belongs to a hall you do not have access to."
        emptyTitle="That event could not be opened"
        isEmpty
        onRetry={eventsQuery.refetch}
        showNewBookingAction={false}
        subtitle="Select an event, then manage every connected section from one workspace."
        title="Event Manager"
      />
    );
  }

  // `deepLinkEvent` ahead of the first row, so the render before the selection
  // effect lands does not open somebody else's event for a moment.
  const selectedEvent =
    allEvents.find((event) => event.id === selectedEventId) ??
    deepLinkEvent ??
    allEvents[0];
  const normalizedSearch = pageSearchQuery.trim().toLowerCase();
  const visibleEvents = allEvents.filter((event) => {
    const matchesSearch =
      !normalizedSearch ||
      [
        event.title,
        event.room,
        event.packageName,
        event.status,
        event.bookingStatus,
        event.paymentStatus,
        event.date
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    const matchesStatus =
      eventStatusFilter === "All events" || event.status === eventStatusFilter;
    const matchesLifecycle =
      eventLifecycleFilter === "All" ||
      (eventLifecycleFilter === "Active" &&
        !["CANCELLED", "COMPLETED", "EXPIRED"].includes(event.bookingStatus)) ||
      (eventLifecycleFilter === "Completed" &&
        event.bookingStatus === "COMPLETED") ||
      (eventLifecycleFilter === "Cancelled" &&
        ["CANCELLED", "EXPIRED"].includes(event.bookingStatus));

    return (
      matchesSearch &&
      matchesStatus &&
      matchesLifecycle &&
      (roomFilter === "All rooms" || event.hallId === roomFilter)
    );
  });

  return (
    <div className="flex min-h-dvh flex-col overflow-x-hidden bg-[#f5f6f8] text-[#17202a] xl:h-screen xl:overflow-hidden">
      <DashboardTopbar
        title="Event Manager"
        subtitle="Select an event, then manage every connected section from one workspace."
        compactMobileActions
        onTodayNotes={() => setIsTodayNotesOpen(true)}
        showNewBookingAction={false}
      />

      <TodayNotesDrawer
        onClose={() => setIsTodayNotesOpen(false)}
        open={isTodayNotesOpen}
      />

      <div className="min-h-0 w-full min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto px-2 pb-2 pt-4 sm:p-3">
        <div className="grid h-auto w-full min-w-0 max-w-full gap-3 overflow-hidden xl:h-full xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="flex w-full min-w-0 max-w-full flex-col overflow-hidden rounded-lg border border-[#d8dde5] bg-white">
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[#d8dde5] p-3">
              <div>
                <div className="flex items-center gap-2">
                  <LineIcon name="calendar" />
                  <h2 className="text-sm font-black text-[#17202a]">Events</h2>
                </div>
                <p className="mt-1 text-xs text-[#6a7483]">
                  {allEvents.length} records
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  aria-expanded={isEventListExpanded}
                  aria-label={
                    isEventListExpanded
                      ? "Collapse event list"
                      : "Expand event list"
                  }
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#1f4d73] hover:bg-[#eef4fa] xl:hidden"
                  onClick={() =>
                    setIsEventListExpanded((isExpanded) => !isExpanded)
                  }
                  type="button"
                >
                  <LineIcon
                    name="chevron"
                    className={`h-5 w-5 transition-transform ${
                      isEventListExpanded ? "rotate-90" : ""
                    }`}
                  />
                </button>
                <button
                  className="hidden h-8 items-center gap-2 rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black hover:bg-[#eef4fa] xl:inline-flex"
                  onClick={() => {
                    setPageSearchQuery("");
                    setEventStatusFilter("All events");
                    setEventLifecycleFilter("Active");
                    setRoomFilter("All rooms");
                    setSelectedEventId(allEvents[0]?.id ?? "");
                  }}
                  type="button"
                >
                  <LineIcon name="close" />
                  Clear
                </button>
              </div>
            </header>

            <div
              className={`shrink-0 border-b border-[#d8dde5] p-3 xl:block ${
                isEventListExpanded ? "block" : "hidden"
              }`}
            >
              <div className="grid grid-cols-2 gap-2 xl:grid-cols-[minmax(0,1fr)_136px]">
                <input
                  className="col-span-2 h-9 min-w-0 rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm text-[#17202a] xl:col-span-1"
                  name="eventSearch"
                  onChange={(event) => setPageSearchQuery(event.target.value)}
                  placeholder="Search client, hall, type"
                  type="search"
                  value={pageSearchQuery}
                />
                <select
                  className="h-9 min-w-0 rounded-lg border border-[#b9c2cf] bg-white pl-3 pr-8 text-sm text-[#17202a]"
                  aria-label="Event filter"
                  name="eventFilter"
                  onChange={(event) => setEventStatusFilter(event.target.value)}
                  value={eventStatusFilter}
                >
                  <option>All events</option>
                  <option>Confirmed</option>
                  <option>Hold</option>
                </select>
                <select
                  aria-label="Lifecycle filter"
                  className="h-9 min-w-0 rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm text-[#17202a]"
                  name="lifecycleFilter"
                  onChange={(event) =>
                    setEventLifecycleFilter(event.target.value)
                  }
                  value={eventLifecycleFilter}
                >
                  <option>Active</option>
                  <option>Completed</option>
                  <option>Cancelled</option>
                  <option>All</option>
                </select>
                <select
                  className="h-9 min-w-0 rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm text-[#17202a]"
                  aria-label="Room filter"
                  name="roomFilter"
                  onChange={(event) => setRoomFilter(event.target.value)}
                  value={roomFilter}
                >
                  <option>All rooms</option>
                  {(eventsQuery.data?.halls ?? []).map((hall) => (
                    <option key={hall.id} value={hall.id}>
                      {hall.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div
              className={`max-h-56 min-h-0 flex-none space-y-2 overflow-y-auto p-3 xl:flex xl:max-h-none xl:flex-1 xl:flex-col ${
                isEventListExpanded ? "block" : "hidden"
              }`}
            >
              {visibleEvents.map((event) => (
                <EventListCard
                  key={event.id}
                  event={event}
                  selected={event.id === selectedEvent.id}
                  onClick={() => {
                    setSelectedEventId(event.id);
                    setIsEventListExpanded(false);
                  }}
                />
              ))}
              {visibleEvents.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[#c7d0dc] p-4 text-center text-xs font-bold text-[#6a7483]">
                  No events match this search.
                </p>
              ) : null}
            </div>
          </aside>

          <EventWorkspace
            event={selectedEvent}
            halls={eventsQuery.data?.halls ?? []}
            onEventSaved={eventsQuery.refetch}
          />
        </div>
      </div>
    </div>
  );
}
