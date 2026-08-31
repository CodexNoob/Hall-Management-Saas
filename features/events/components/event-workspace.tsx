"use client";

import { useState } from "react";
import { ClientPortalPreviewDrawer } from "@/features/events/components/client-portal-preview-drawer";
import { PrintPacketDrawer } from "@/features/events/components/print-packet-drawer";
import { centerMobileTab } from "@/lib/ui/center-mobile-tab";
import { showBillingReadouts } from "@/lib/ui/mvp-features";
import { EventBillingContent } from "@/features/events/components/event-billing-content";
import { ClientPortalContent } from "@/features/events/components/event-client-portal-content";
import {
  ActivityPanel,
  ClientContact,
  EventInformation,
  ReadinessPanel
} from "@/features/events/components/event-details-panel";
import { TimelineInstructions } from "@/features/events/components/event-timeline-card";
import { EventFilesContent } from "@/features/events/components/event-files-content";
import { HallMapContent } from "@/features/events/components/event-hall-map-content";
import { EventKitchenContent } from "@/features/events/components/event-kitchen-content";
import { EventMenuContent } from "@/features/events/components/event-menu-content";
import { EventTabPlaceholder } from "@/features/events/components/event-tab-placeholder";
import {
  ActionButton,
  Badge,
  LineIcon,
  tabs,
  type EventFile,
  type EventCoordinatorOption,
  type EventHallOption,
  type EventTypeOption,
  type EventWorkspaceTab
} from "@/features/events/components/event-manager-shared";

export function EventWorkspace({
  activeTab,
  event,
  coordinators,
  eventTypes,
  halls,
  onEventSaved,
  onTabChange
}: {
  activeTab: EventWorkspaceTab;
  event: EventFile;
  coordinators: EventCoordinatorOption[];
  eventTypes: EventTypeOption[];
  halls: EventHallOption[];
  onEventSaved: () => Promise<unknown>;
  /// Held by the page rather than here, because the event list needs to know
  /// which tab is open to decide what is worth warming when a row is hovered.
  onTabChange: (tab: EventWorkspaceTab) => void;
}) {
  const [isWorkspaceExpanded, setIsWorkspaceExpanded] = useState(true);
  const [isPrintPacketOpen, setIsPrintPacketOpen] = useState(false);
  const [isPortalPreviewOpen, setIsPortalPreviewOpen] = useState(false);
  const lifecycleLabel =
    event.bookingStatus === "COMPLETED"
      ? "Completed"
      : ["CANCELLED", "EXPIRED"].includes(event.bookingStatus)
        ? "Cancelled"
        : event.status;
  const lifecycleTone =
    event.bookingStatus === "COMPLETED"
      ? "green"
      : ["CANCELLED", "EXPIRED"].includes(event.bookingStatus)
        ? "red"
        : event.status === "Confirmed"
          ? "green"
          : "gold";

  return (
    <section className="flex h-auto w-full min-w-0 max-w-full flex-col overflow-x-hidden overflow-y-visible rounded-lg border border-[#d8dde5] bg-[#fbfcfd] xl:h-full xl:overflow-hidden">
      <header className="shrink-0 border-b border-[#d8dde5] bg-white p-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <LineIcon name="calendar" />
                <h1 className="truncate text-xl font-black text-[#17202a]">
                  {event.title}
                </h1>
              </div>
              <button
                aria-expanded={isWorkspaceExpanded}
                aria-label={
                  isWorkspaceExpanded
                    ? "Collapse event sections"
                    : "Expand event sections"
                }
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-[#1f4d73] transition hover:bg-[#eef4fa] xl:hidden"
                onClick={() =>
                  setIsWorkspaceExpanded((isExpanded) => !isExpanded)
                }
                type="button"
              >
                <LineIcon
                  name="chevron"
                  className={`h-5 w-5 transition-transform ${
                    isWorkspaceExpanded ? "rotate-90" : ""
                  }`}
                />
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone={lifecycleTone}>{lifecycleLabel}</Badge>
              {showBillingReadouts ? (
                <Badge tone="gold">Open balance {event.balance}</Badge>
              ) : null}
              <Badge tone="gold">Today notes unread</Badge>
              <Badge tone="gold">Needs review</Badge>
            </div>
          </div>
          <div
            className={`w-full shrink-0 grid-cols-2 gap-2 sm:ml-auto sm:w-auto sm:flex-nowrap sm:items-center sm:justify-end xl:flex ${
              isWorkspaceExpanded ? "grid sm:flex" : "hidden"
            }`}
          >
            <ActionButton
              icon="document"
              onClick={() => setIsPortalPreviewOpen(true)}
            >
              Preview portal
            </ActionButton>
            <ActionButton
              icon="printer"
              onClick={() => setIsPrintPacketOpen(true)}
              primary
            >
              Print packet
            </ActionButton>
          </div>
        </div>
      </header>

      <PrintPacketDrawer
        event={event}
        onClose={() => setIsPrintPacketOpen(false)}
        open={isPrintPacketOpen}
      />
      <ClientPortalPreviewDrawer
        event={event}
        onClose={() => setIsPortalPreviewOpen(false)}
        open={isPortalPreviewOpen}
      />

      {/* Named because the sidebar has its own "Menu" and "Files" buttons, so
          without this the two navigations are indistinguishable to a screen
          reader - and to anything else looking a tab up by name. */}
      <nav
        aria-label="Event workspace"
        className={`scrollbar-none shrink-0 gap-1 overflow-x-auto border-b border-[#d8dde5] bg-white px-3 xl:flex ${
          isWorkspaceExpanded ? "flex" : "hidden"
        }`}
      >
        {tabs.map((tab) => (
          <button
            key={tab.label}
            className={`inline-flex h-10 shrink-0 items-center gap-2 border-b-3 px-2 text-xs font-black ${
              activeTab === tab.label
                ? "border-[#1f4d73] text-[#17202a]"
                : "border-transparent text-[#17202a] hover:bg-[#eef4fa]"
            }`}
            type="button"
            onClick={(clickEvent) => {
              onTabChange(tab.label);
              centerMobileTab(clickEvent.currentTarget);
              setIsWorkspaceExpanded(true);
            }}
          >
            <LineIcon name={tab.icon} className="h-3.5 w-3.5 text-[#516174]" />
            {tab.label}
          </button>
        ))}
      </nav>

      <div
        className={`min-h-0 w-full min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-visible p-3 xl:block xl:overflow-y-auto ${
          isWorkspaceExpanded ? "block" : "hidden"
        }`}
      >
        {activeTab === "Event details" ? (
          <div className="min-w-0">
            <div className="grid min-w-0 gap-3 overflow-hidden xl:grid-cols-[minmax(0,1fr)_336px]">
              <div className="min-w-0 space-y-4">
                <EventInformation
                  event={event}
                  coordinators={coordinators}
                  eventTypes={eventTypes}
                  halls={halls}
                  onEventSaved={onEventSaved}
                />
                {/* The booking record and the day-of schedule save and confirm
                    separately. Left as two cards in one even stack their save
                    rows read as one form with a stray second pair of buttons,
                    so the column is ruled across between them. Decoration
                    only - the timeline card names itself again below. */}
                <div className="flex items-center gap-3 pt-1" aria-hidden>
                  <span className="h-px flex-1 bg-[#d8dde5]" />
                  <span className="text-[11px] font-black uppercase tracking-[0.08em] text-[#6a7483]">
                    Day-of schedule
                  </span>
                  <span className="h-px flex-1 bg-[#d8dde5]" />
                </div>
                <TimelineInstructions
                  event={event}
                  onEventSaved={onEventSaved}
                />
              </div>
              <aside className="space-y-3">
                <ClientContact event={event} />
                <ReadinessPanel event={event} />
                <ActivityPanel event={event} />
              </aside>
            </div>
          </div>
        ) : null}

        {activeTab === "Menu" ? (
          <EventMenuContent event={event} onEventSaved={onEventSaved} />
        ) : null}
        {activeTab === "Client portal" ? (
          <ClientPortalContent event={event} />
        ) : null}
        {activeTab === "Billing" ? <EventBillingContent /> : null}
        {activeTab === "Hall map" ? (
          <HallMapContent key={event.id} event={event} />
        ) : null}
        {activeTab === "Kitchen" ? <EventKitchenContent event={event} /> : null}
        {activeTab === "Files" ? (
          <EventFilesContent
            clientName={event.clientName}
            eventId={event.id}
            eventType={event.eventType}
          />
        ) : null}
        {![
          "Event details",
          "Menu",
          "Client portal",
          "Billing",
          "Hall map",
          "Kitchen",
          "Files"
        ].includes(activeTab) ? (
          <EventTabPlaceholder label={activeTab} />
        ) : null}
      </div>
    </section>
  );
}
