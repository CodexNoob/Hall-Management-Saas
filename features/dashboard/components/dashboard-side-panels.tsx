"use client";

import { useRouter } from "next/navigation";

import {
  StatusBadge,
  formatEventDate,
  type ScheduleRow,
  type TimelineGroup
} from "@/components/layout/dashboard-shell-shared";
import { useDashboardAccess } from "@/features/dashboard/hooks/use-dashboard-permission";

type DashboardSidePanelsProps = {
  isLoading: boolean;
  onNewBooking: () => void;
  rangeLabel: string;
  timelineGroups: TimelineGroup[];
  totalEvents: number;
};

// Route shortcuts are filtered with canAccessRoute, exactly as
// dashboard-sidebar.tsx and dashboard-topbar.tsx filter their own targets, so
// this panel can never offer a page the sidebar hides or the layout guard
// refuses. "Book event" opens a dialog rather than a route, so it keeps the
// canCreateBooking check the dialog itself uses
// (features/bookings/forms/new-booking-dialog.tsx) - the difference is that the
// topbar's copy stays visible-but-disabled, because that chrome is shared by
// every dashboard route while this panel is home-page content.
type QuickAction =
  | { label: string; kind: "booking" }
  | { label: string; kind: "route"; route: string };

const quickActions: QuickAction[] = [
  { label: "Book event", kind: "booking" },
  { label: "Kitchen board", kind: "route", route: "/dashboard/kitchen" },
  { label: "Open billing", kind: "route", route: "/dashboard/billing" },
  { label: "Dining sheets", kind: "route", route: "/dashboard/dining-manager" }
];

export function DashboardSidePanels({
  isLoading,
  onNewBooking,
  rangeLabel,
  timelineGroups,
  totalEvents
}: DashboardSidePanelsProps) {
  const { canAccessRoute, hasPermission } = useDashboardAccess();
  const showEventsTimeline = hasPermission([
    "canViewCalendar",
    "canViewEventManager"
  ]);
  // The panel's hardcoded sample items include an open-balance notice, so it
  // follows payment visibility rather than general event visibility.
  const showAttentionNeeded = hasPermission("canViewPaymentInfo");
  const visibleActions = quickActions.filter((action) =>
    action.kind === "booking"
      ? hasPermission("canCreateBooking")
      : canAccessRoute(action.route)
  );

  // Collapses the grid's side column instead of leaving an empty 320px track.
  if (!showEventsTimeline && !showAttentionNeeded && visibleActions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-5">
      {showEventsTimeline ? (
        <EventsTimelinePanel
          isLoading={isLoading}
          rangeLabel={rangeLabel}
          timelineGroups={timelineGroups}
          totalEvents={totalEvents}
        />
      ) : null}
      {showAttentionNeeded ? <AttentionNeededPanel /> : null}
      <QuickActionsPanel actions={visibleActions} onNewBooking={onNewBooking} />
    </div>
  );
}

function EventsTimelinePanel({
  isLoading,
  rangeLabel,
  timelineGroups,
  totalEvents
}: Omit<DashboardSidePanelsProps, "onNewBooking">) {
  const router = useRouter();
  const { canAccessRoute } = useDashboardAccess();
  // Navigation affordances use the any-of route check, so the page never hides
  // a link to a route the sidebar and the layout guard would both allow.
  const canOpenEvents = canAccessRoute("/dashboard/events");

  return (
    <section className="overflow-hidden rounded-2xl border border-[#d8dde5] bg-white shadow-sm shadow-[#17202a]/4">
      <div className="border-b border-[#d8dde5] p-5">
        <h2 className="text-base font-black text-[#17202a]">
          Events timeline
        </h2>
        <p className="mt-1 text-xs font-medium text-[#6a7483]">
          {totalEvents} events from {rangeLabel}.
        </p>
      </div>

      <div className="max-h-96 space-y-4 overflow-y-auto p-4">
        {timelineGroups.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#c7d0dc] p-4 text-sm font-bold text-[#6a7483]">
            {isLoading
              ? "Loading timeline..."
              : "No timeline items for this filter."}
          </p>
        ) : (
          timelineGroups.map((group) => (
            <TimelineGroupCard
              group={group}
              key={group.date}
              onOpenEvent={
                canOpenEvents ? () => router.push("/dashboard/events") : undefined
              }
            />
          ))
        )}
      </div>
    </section>
  );
}

function TimelineGroupCard({
  group,
  onOpenEvent
}: {
  group: TimelineGroup;
  onOpenEvent?: (row: ScheduleRow) => void;
}) {
  return (
    <div className="relative pl-5">
      <span className="absolute bottom-0 left-1.5 top-7 w-px bg-[#d8dde5]" />
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full bg-[#1f4d73]" />
        <h3 className="text-sm font-black text-[#17202a]">
          {formatEventDate(group.date)}
        </h3>
        <span className="rounded-full bg-[#eef4fa] px-2 py-1 text-[10px] font-black text-[#1f4d73]">
          {group.rows.length}
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {group.rows.map((row) => {
          const summary = (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-[#17202a]">
                  {row.event}
                </p>
                <p className="mt-1 text-xs font-medium text-[#6a7483]">
                  {row.time} - {row.room}
                </p>
              </div>
              <StatusBadge status={row.status} />
            </div>
          );

          return onOpenEvent ? (
            <button
              className="w-full rounded-xl border border-[#d8dde5] bg-white p-3 text-left transition hover:border-[#1f4d73] hover:bg-[#fbfcfd]"
              key={row.id}
              onClick={() => onOpenEvent(row)}
              type="button"
            >
              {summary}
            </button>
          ) : (
            <div
              className="w-full rounded-xl border border-[#d8dde5] bg-white p-3 text-left"
              key={row.id}
            >
              {summary}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AttentionNeededPanel() {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#d8dde5] bg-white shadow-sm shadow-[#17202a]/4">
      <div className="border-b border-[#d8dde5] p-5">
        <h2 className="text-base font-black text-[#17202a]">
          Attention needed
        </h2>
        <p className="mt-1 text-xs font-medium text-[#6a7483]">
          Issues blocking a clean operating day.
        </p>
      </div>

      <div className="space-y-2.5 p-4">
        <div className="rounded-xl border border-[#9a5b00] bg-[#fbfcfd] p-3 text-xs leading-5 text-[#9a5b00]">
          <strong>Nachlas Yehuda menu lock:</strong> Second room booking must
          follow the first menu for the night.
        </div>
        <div className="rounded-xl border border-[#a62b24] bg-[#fbfcfd] p-3 text-xs leading-5 text-[#a62b24]">
          <strong>Friedman Dinner:</strong> Final balance remains open. Event
          starts 8:30 PM.
        </div>
        <div className="rounded-xl border border-[#b9c2cf] bg-[#eef4fa] p-3 text-xs leading-5 text-[#1f4d73]">
          <strong>Vendor delivery:</strong> Linen order for Grand Hall marked
          ready, not received.
        </div>
      </div>
    </section>
  );
}

function QuickActionsPanel({
  actions,
  onNewBooking
}: {
  actions: QuickAction[];
  onNewBooking: () => void;
}) {
  const router = useRouter();

  if (actions.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-[#d8dde5] bg-white shadow-sm shadow-[#17202a]/4">
      <div className="border-b border-[#d8dde5] p-5">
        <h2 className="text-base font-black text-[#17202a]">Quick actions</h2>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2">
        {actions.map((item) => (
          <button
            className="h-10 rounded-lg border border-[#b9c2cf] bg-white px-4 text-sm font-black text-[#17202a] transition hover:border-[#1f4d73] hover:bg-[#eef4fa]"
            key={item.label}
            type="button"
            onClick={() => {
              if (item.kind === "booking") {
                onNewBooking();
                return;
              }

              router.push(item.route as Parameters<typeof router.push>[0]);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </section>
  );
}
