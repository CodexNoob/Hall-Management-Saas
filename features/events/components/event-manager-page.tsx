"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardTopbar } from "@/components/layout/dashboard-topbar";
import { DashboardPageState } from "@/components/layout/dashboard-page-state";
import { requestDashboardSidebarCollapse } from "@/components/layout/dashboard-sidebar-shared";
import {
  prefetchAuthenticatedQuery,
  useAuthenticatedQuery
} from "@/features/dashboard/hooks/use-authenticated-query";

import { EventListCard } from "@/features/events/components/event-list-panel";
import { EventWorkspace } from "@/features/events/components/event-workspace";
import { EventWorkspaceEmpty } from "@/features/events/components/event-workspace-empty";
import {
  LineIcon,
  type EventFile,
  type EventsResponse,
  type EventWorkspaceTab
} from "@/features/events/components/event-manager-shared";
export function EventManagerPage() {
  // Plain state, not `useDashboardPageSearch`: the topbar no longer carries a
  // search box on this page, so nothing outside the event list can set it.
  const [pageSearchQuery, setPageSearchQuery] = useState("");
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
  const [activeTab, setActiveTab] =
    useState<EventWorkspaceTab>("Event details");
  const [eventStatusFilter, setEventStatusFilter] = useState("All events");
  const [eventLifecycleFilter, setEventLifecycleFilter] = useState("Active");
  const [roomFilter, setRoomFilter] = useState("All rooms");
  const [isEventListExpanded, setIsEventListExpanded] = useState(true);
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
          eventTypeId: event.eventTypeId ?? "",
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
          packageId: event.packageId ?? "",
          packageName: event.packageName ?? "Not assigned",
          guests: String(guestCount),
          children: String(
            event.kidsCount + event.boysCount + event.girlsCount
          ),
          couples: String(event.couplesCount),
          // "Unassigned" is the reading of no coordinator, not a placeholder
          // standing in for one - which is all this was until the column
          // existed.
          coordinator: event.coordinator?.user.name ?? "Unassigned",
          coordinatorMembershipId: event.coordinatorMembershipId ?? "",
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

  // A link that names an event is the one thing that opens one on arrival.
  // Nothing else does: the workspace used to fall back to the first event in the
  // list, which presented a selection the user had not made - and since the list
  // filters to Active by default while the first event by start time is usually
  // finished or expired, its row was normally not even rendered to be
  // highlighted. Landing on an empty pane says what is true, that nothing is
  // open yet.
  useEffect(() => {
    if (!deepLinkEvent) return;

    // Only ever the first selection, so a later click in the list is not
    // snapped back to whatever the link said.
    setSelectedEventId((current) => current || deepLinkEvent.id);
  }, [deepLinkEvent]);

  if (eventsQuery.isLoading) {
    return (
      <DashboardPageState
        isLoading
        showDefaultActions={false}
        showSearch={false}
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
        showDefaultActions={false}
        showSearch={false}
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
        showDefaultActions={false}
        showSearch={false}
        subtitle="Select an event, then manage every connected section from one workspace."
        title="Event Manager"
      />
    );
  }

  // `deepLinkEvent` is read here as well as in the effect, so the render before
  // the effect lands already has the linked event open rather than flashing the
  // empty pane on the way to it. Null when nothing is selected, which is the
  // state the page now starts in.
  const selectedEvent =
    allEvents.find((event) => event.id === selectedEventId) ??
    deepLinkEvent ??
    null;
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
      {/* No topbar search or actions: the event list has its own search box,
          and a second one above it only split the same filter across two
          inputs. */}
      <DashboardTopbar
        title="Event Manager"
        subtitle="Select an event, then manage every connected section from one workspace."
        compactMobileActions
        showDefaultActions={false}
        showSearch={false}
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
                    // Clearing the filters clears the selection too, rather than
                    // handing the pane the first row of the reset list.
                    setSelectedEventId("");
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
                  selected={event.id === selectedEvent?.id}
                  onClick={() => {
                    setSelectedEventId(event.id);
                    setIsEventListExpanded(false);
                    // The workspace that just opened is the widest thing on the
                    // page, so give it the sidebar's width the way the list
                    // gives it its own above. Deep links are left alone: nobody
                    // expects a page to close the nav on them as it loads.
                    requestDashboardSidebarCollapse();
                  }}
                  // Only what the open tab would actually ask for. Warming
                  // every tab of every hovered row would trade one wait for a
                  // burst of requests nobody asked for.
                  onPrefetch={
                    activeTab === "Menu"
                      ? () => {
                          void prefetchAuthenticatedQuery(
                            `/api/events/${event.id}/menu`
                          );
                        }
                      : undefined
                  }
                />
              ))}
              {visibleEvents.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[#c7d0dc] p-4 text-center text-xs font-bold text-[#6a7483]">
                  No events match this search.
                </p>
              ) : null}
            </div>
          </aside>

          {selectedEvent ? (
            <EventWorkspace
              activeTab={activeTab}
              coordinators={eventsQuery.data?.coordinators ?? []}
              event={selectedEvent}
              eventTypes={eventsQuery.data?.eventTypes ?? []}
              halls={eventsQuery.data?.halls ?? []}
              onEventSaved={eventsQuery.refetch}
              onTabChange={setActiveTab}
            />
          ) : (
            <EventWorkspaceEmpty />
          )}
        </div>
      </div>
    </div>
  );
}
