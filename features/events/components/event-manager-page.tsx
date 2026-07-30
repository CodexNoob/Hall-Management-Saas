"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  NewEventDialog,
  type NewEventFormValues
} from "@/features/events/forms/new-event-dialog";
import { DashboardTopbar } from "@/components/layout/dashboard-topbar";
import { DashboardPageState } from "@/components/layout/dashboard-page-state";
import {
  clearCachedSyncedUser,
  getCachedSyncedUser,
  syncSignedInUser,
  type SyncSignedInUserResponse
} from "@/lib/auth/client";
import { useAuthenticatedMutation } from "@/features/dashboard/hooks/use-authenticated-mutation";
import { useAuthenticatedQuery } from "@/features/dashboard/hooks/use-authenticated-query";
import { useDashboardPageSearch } from "@/features/dashboard/hooks/use-dashboard-page-search";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";


import { EventListCard } from "@/features/events/components/event-list-panel";
import { EventWorkspace } from "@/features/events/components/event-workspace";
import { LineIcon, type EventFile, type EventsResponse } from "@/features/events/components/event-manager-shared";
export function EventManagerPage() {
  const [pageSearchQuery, setPageSearchQuery] =
    useDashboardPageSearch("Event Manager");
  const router = useRouter();
  const eventsQuery = useAuthenticatedQuery<EventsResponse>("/api/events");
  const createEventMutation = useAuthenticatedMutation<
    Record<string, string | number | undefined>,
    { event: { id: string } }
  >("/api/events");
  const [syncData, setSyncData] = useState<SyncSignedInUserResponse | null>(
    null
  );
  const [selectedEventTitle, setSelectedEventTitle] = useState("");
  const [isEventListExpanded, setIsEventListExpanded] = useState(true);
  const [isNewEventOpen, setIsNewEventOpen] = useState(false);
  const allEvents = useMemo<EventFile[]>(
    () =>
      (eventsQuery.data?.events ?? []).map((event) => {
        const date = new Date(event.eventDate);
        const guestCount =
          event.couplesCount * 2 +
          event.menCount +
          event.ladiesCount +
          event.boysCount +
          event.girlsCount +
          event.kidsCount;

        return {
          title: `${event.clientName}${event.eventType ? ` ${event.eventType}` : ""}`,
          date: new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            timeZone: "UTC"
          }).format(date),
          time: event.startsAt
            ? new Intl.DateTimeFormat("en-US", {
                hour: "numeric",
                minute: "2-digit"
              }).format(new Date(event.startsAt))
            : "Time not set",
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
          notes: event.notes ? [event.notes] : []
        };
      }),
    [eventsQuery.data]
  );

  useEffect(() => {
    let isMounted = true;
    const cachedSyncData = getCachedSyncedUser();

    if (cachedSyncData) {
      setSyncData(cachedSyncData);
    }

    async function loadUser() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase.auth.getSession();

        if (error || !data.session?.access_token) {
          clearCachedSyncedUser();
          router.replace("/");
          return;
        }

        const synced = await syncSignedInUser(data.session.access_token);

        if (isMounted) {
          setSyncData(synced);
        }
      } catch {
        if (!cachedSyncData) {
          clearCachedSyncedUser();
          router.replace("/");
        }
      }
    }

    loadUser();

    return () => {
      isMounted = false;
    };
  }, [router]);

  if (!syncData || eventsQuery.isLoading) {
    return (
      <DashboardPageState
        isLoading
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
        subtitle="Select an event, then manage every connected section from one workspace."
        title="Event Manager"
      />
    );
  }

  const selectedEvent =
    allEvents.find((event) => event.title === selectedEventTitle) ??
    allEvents[0];
  const normalizedSearch = pageSearchQuery.trim().toLowerCase();
  const visibleEvents = allEvents.filter(
    (event) =>
      !normalizedSearch ||
      [
        event.title,
        event.room,
        event.packageName,
        event.status,
        event.paymentStatus,
        event.date
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch)
  );

  const createEvent = async (values: NewEventFormValues) => {
    const hall = eventsQuery.data?.halls.find(
      (item) => item.name === values.room
    );
    const eventType = eventsQuery.data?.eventTypes.find(
      (item) => item.name === values.eventType
    );

    if (!hall) return;

    const toIso = (time: string) =>
      new Date(`${values.date}T${time}:00`).toISOString();
    const startsAt = toIso(values.startTime);
    let endsAt = toIso(values.endTime);
    let cleanupEndsAt = toIso(values.cleanupTime);
    if (new Date(endsAt) <= new Date(startsAt)) {
      endsAt = new Date(new Date(endsAt).getTime() + 86_400_000).toISOString();
    }
    if (new Date(cleanupEndsAt) < new Date(endsAt)) {
      cleanupEndsAt = new Date(
        new Date(cleanupEndsAt).getTime() + 86_400_000
      ).toISOString();
    }

    await createEventMutation.mutate({
      clientName: values.clientName,
      phone: "Not provided",
      eventDate: values.date,
      startsAt,
      endsAt,
      setupStartsAt: toIso(values.setupTime),
      cleanupEndsAt,
      hallId: hall.id,
      eventTypeId: eventType?.id,
      bookingStatus:
        values.status === "Confirmed" ? "CONFIRMED" : "TENTATIVE_HOLD",
      idempotencyKey: crypto.randomUUID(),
      couplesCount: Number(values.couples) || 0,
      menCount: Math.max(
        (Number(values.guests) || 0) -
          (Number(values.couples) || 0) * 2 -
          (Number(values.children) || 0),
        0
      ),
      kidsCount: Number(values.children) || 0,
      notes: values.initialNotes || undefined
    });
    await eventsQuery.refetch();
    setSelectedEventTitle(`${values.clientName} ${values.eventType}`.trim());
    setIsNewEventOpen(false);
  };

  return (
    <div className="flex min-h-dvh flex-col overflow-x-hidden bg-[#f5f6f8] text-[#17202a] xl:h-screen xl:overflow-hidden">
      <DashboardTopbar
        title="Event Manager"
        subtitle="Select an event, then manage every connected section from one workspace."
        compactMobileActions
        actionsSlot={
          <button
            aria-label="Create new event"
            className="inline-flex h-9 w-8 shrink-0 items-center justify-center whitespace-nowrap bg-transparent p-0 text-[#1f4d73] transition hover:text-[#15344f] [&_svg]:h-6 [&_svg]:w-6 lg:h-11 lg:w-auto lg:gap-2 lg:rounded-xl lg:bg-[#1f4d73] lg:px-4 lg:text-sm lg:text-white lg:shadow-lg lg:shadow-[#17202a]/15 lg:hover:-translate-y-0.5 lg:hover:bg-[#15344f] lg:[&_svg]:h-4 lg:[&_svg]:w-4 2xl:px-5"
            onClick={() => setIsNewEventOpen(true)}
            title="New event"
            type="button"
          >
            <LineIcon name="plus" />
            <span className="hidden lg:inline">New event</span>
          </button>
        }
      />

      <NewEventDialog
        onClose={() => setIsNewEventOpen(false)}
        onCreate={createEvent}
        open={isNewEventOpen}
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
                  defaultValue="All events"
                  name="eventFilter"
                >
                  <option>All events</option>
                  <option>Confirmed</option>
                  <option>Hold</option>
                </select>
                <select
                  className="h-9 min-w-0 rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm text-[#17202a] xl:col-span-2"
                  aria-label="Room filter"
                  defaultValue="All rooms"
                  name="roomFilter"
                >
                  <option>All rooms</option>
                  <option>Grand Hall</option>
                  <option>Nachlas Yehuda A</option>
                  <option>Terrace Room</option>
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
                  key={event.title}
                  event={event}
                  selected={event.title === selectedEvent.title}
                  onClick={() => {
                    setSelectedEventTitle(event.title);
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

          <EventWorkspace event={selectedEvent} />
        </div>
      </div>
    </div>
  );
}
