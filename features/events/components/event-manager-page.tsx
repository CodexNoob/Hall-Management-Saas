"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardTopbar } from "@/components/layout/dashboard-topbar";
import { DashboardPageState } from "@/components/layout/dashboard-page-state";
import { TodayNotesDrawer } from "@/components/shared/today-notes-drawer";
import {
  prefetchAuthenticatedQuery,
  useAuthenticatedQuery
} from "@/features/dashboard/hooks/use-authenticated-query";
import { useDashboardPageSearch } from "@/features/dashboard/hooks/use-dashboard-page-search";

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
  const [activeTab, setActiveTab] =
    useState<EventWorkspaceTab>("Event details");
  const [eventStatusFilter, setEventStatusFilter] = useState("All events");
  const [eventLifecycleFilter, setEventLifecycleFilter] = useState("Active");
  const [roomFilter, setRoomFilter] = useState("All rooms");
  const [isEventListExpanded, setIsEventListExpanded] = useState(true);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [isTodayNotesOpen, setIsTodayNotesOpen] = useState(false);
  // Event details keeps its edits in a draft that only survives while it is
  // mounted, so leaving the tab or the event throws them away. The page holds
  // the flag because both of those moves are made out here.
  const [hasUnsavedDetails, setHasUnsavedDetails] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<
    (() => void) | null
  >(null);
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

  // Covers the exits this page cannot intercept itself - closing the tab, the
  // back button, a link out to another dashboard page.
  useEffect(() => {
    if (!hasUnsavedDetails) return;

    const warnBeforeLeaving = (unloadEvent: BeforeUnloadEvent) =>
      unloadEvent.preventDefault();

    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [hasUnsavedDetails]);

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
  // The API hands the list back ordered by start time, so runs of the same day
  // are already adjacent and a single pass is enough to head them.
  const eventsByDate = visibleEvents.reduce<
    Array<{ date: string; events: EventFile[] }>
  >((groups, event) => {
    const openGroup = groups.at(-1);

    if (openGroup?.date === event.date) {
      openGroup.events.push(event);
    } else {
      groups.push({ date: event.date, events: [event] });
    }

    return groups;
  }, []);
  const activeFilterCount =
    (eventStatusFilter === "All events" ? 0 : 1) +
    (eventLifecycleFilter === "Active" ? 0 : 1) +
    (roomFilter === "All rooms" ? 0 : 1);

  /**
   * Runs `navigate` unless Event details is holding edits, in which case it is
   * parked until the user says what to do with them.
   */
  function guardUnsavedWork(navigate: () => void) {
    if (!hasUnsavedDetails) {
      navigate();
      return;
    }

    setPendingNavigation(() => navigate);
  }

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
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#d8dde5] px-4 py-3">
              <div className="flex items-baseline gap-2">
                <h2 className="text-sm font-semibold text-[#17202a]">Events</h2>
                <p className="text-xs font-normal text-[#8b95a5]">
                  {visibleEvents.length === allEvents.length
                    ? `${allEvents.length}`
                    : `${visibleEvents.length} of ${allEvents.length}`}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  className="hidden h-8 items-center rounded-lg px-2.5 text-xs font-medium text-[#516174] hover:bg-[#eef4fa] xl:inline-flex"
                  onClick={() =>
                    guardUnsavedWork(() => {
                      setPageSearchQuery("");
                      setEventStatusFilter("All events");
                      setEventLifecycleFilter("Active");
                      setRoomFilter("All rooms");
                      // Clearing the filters clears the selection too, rather
                      // than handing the pane the first row of the reset list.
                      setSelectedEventId("");
                    })
                  }
                  type="button"
                >
                  Clear
                </button>
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
              </div>
            </header>

            <div
              className={`shrink-0 border-b border-[#d8dde5] px-3 py-3 xl:block ${
                isEventListExpanded ? "block" : "hidden"
              }`}
            >
              {/* Search stays out; the three selects sit behind a disclosure,
                  because presenting all four at equal weight implied they all
                  get equal use and left the list starting 150px down. */}
              <div className="flex gap-2">
                <input
                  className="h-9 min-w-0 flex-1 rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm text-[#17202a]"
                  name="eventSearch"
                  onChange={(event) => setPageSearchQuery(event.target.value)}
                  placeholder="Search client, hall, type"
                  type="search"
                  value={pageSearchQuery}
                />
                <button
                  aria-expanded={isFilterPanelOpen}
                  className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium ${
                    activeFilterCount
                      ? "border-[#1f4d73] bg-[#eef4fa] text-[#1f4d73]"
                      : "border-[#b9c2cf] bg-white text-[#516174] hover:bg-[#eef4fa]"
                  }`}
                  onClick={() =>
                    setIsFilterPanelOpen((isOpen) => !isOpen)
                  }
                  type="button"
                >
                  Filters
                  {activeFilterCount ? (
                    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#1f4d73] px-1 text-[10px] font-semibold text-white">
                      {activeFilterCount}
                    </span>
                  ) : null}
                </button>
              </div>

              {isFilterPanelOpen ? (
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <select
                    className="h-9 min-w-0 rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm text-[#17202a]"
                    aria-label="Event filter"
                    name="eventFilter"
                    onChange={(event) =>
                      setEventStatusFilter(event.target.value)
                    }
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
              ) : null}
            </div>

            <div
              className={`max-h-56 min-h-0 flex-none overflow-y-auto px-2 py-2 xl:flex xl:max-h-none xl:flex-1 xl:flex-col ${
                isEventListExpanded ? "block" : "hidden"
              }`}
            >
              {eventsByDate.map((group) => (
                <section key={group.date}>
                  <h3 className="sticky top-0 z-10 bg-white/95 px-2 py-1.5 text-xs font-medium text-[#8b95a5] backdrop-blur">
                    {group.date}
                  </h3>
                  {group.events.map((event) => (
                    <EventListCard
                      key={event.id}
                      event={event}
                      selected={event.id === selectedEvent?.id}
                      onClick={() =>
                        guardUnsavedWork(() => {
                          setSelectedEventId(event.id);
                          setIsEventListExpanded(false);
                        })
                      }
                      // Only what the open tab would actually ask for. Warming
                      // every tab of every hovered row would trade one wait for
                      // a burst of requests nobody asked for.
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
                </section>
              ))}
              {visibleEvents.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm font-normal text-[#8b95a5]">
                  No events match this search.
                </p>
              ) : null}
            </div>
          </aside>

          {selectedEvent ? (
            <EventWorkspace
              activeTab={activeTab}
              event={selectedEvent}
              halls={eventsQuery.data?.halls ?? []}
              onDirtyChange={setHasUnsavedDetails}
              onEventSaved={eventsQuery.refetch}
              onTabChange={(tab) => guardUnsavedWork(() => setActiveTab(tab))}
            />
          ) : (
            <EventWorkspaceEmpty />
          )}
        </div>
      </div>

      {pendingNavigation ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#17202a]/45 p-4 backdrop-blur-sm"
          role="presentation"
        >
          <section
            aria-labelledby="event-unsaved-title"
            aria-modal="true"
            className="w-full max-w-md overflow-hidden rounded-2xl border border-[#d8dde5] bg-white shadow-2xl"
            role="dialog"
          >
            <header className="px-5 pb-2 pt-5">
              <h3
                className="text-lg font-semibold text-[#17202a]"
                id="event-unsaved-title"
              >
                Leave without saving?
              </h3>
            </header>
            <p className="px-5 pb-5 text-sm font-normal leading-6 text-[#516174]">
              Your edits to this event&apos;s details have not been saved yet.
              Leaving now discards them.
            </p>
            <footer className="flex flex-wrap justify-end gap-2 border-t border-[#d8dde5] bg-[#fbfcfd] px-5 py-4">
              <button
                className="inline-flex h-10 items-center justify-center rounded-xl border border-[#b9c2cf] bg-white px-4 text-sm font-medium text-[#17202a] hover:bg-[#eef4fa]"
                onClick={() => setPendingNavigation(null)}
                type="button"
              >
                Keep editing
              </button>
              <button
                className="inline-flex h-10 items-center justify-center rounded-xl bg-[#b42318] px-4 text-sm font-medium text-white hover:bg-[#912018]"
                onClick={() => {
                  const navigate = pendingNavigation;
                  setPendingNavigation(null);
                  setHasUnsavedDetails(false);
                  navigate();
                }}
                type="button"
              >
                Discard changes
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}
