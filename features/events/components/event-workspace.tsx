"use client";

import { useState } from "react";
import { ClientPortalPreviewDrawer } from "@/features/events/components/client-portal-preview-drawer";
import { PrintPacketDrawer } from "@/features/events/components/print-packet-drawer";
import { centerMobileTab } from "@/lib/ui/center-mobile-tab";
import { EventBillingContent } from "@/features/events/components/event-billing-content";
import { ClientPortalContent } from "@/features/events/components/event-client-portal-content";
import {
  ClientContact,
  EventActivityHistory,
  EventInformation,
  ReadinessPanel,
  TimelineInstructions
} from "@/features/events/components/event-details-panel";
import { EventFilesContent } from "@/features/events/components/event-files-content";
import { HallMapContent } from "@/features/events/components/event-hall-map-content";
import { EventKitchenContent } from "@/features/events/components/event-kitchen-content";
import { EventMenuContent } from "@/features/events/components/event-menu-content";
import { EventTabPlaceholder } from "@/features/events/components/event-tab-placeholder";
import { EventVendorsContent } from "@/features/events/components/event-vendors-content";
import {
  ActionButton,
  Badge,
  LineIcon,
  tabs,
  type EventFile,
  type EventHallOption,
  type EventWorkspaceTab
} from "@/features/events/components/event-manager-shared";
import { getEventReadinessSummary } from "@/features/events/components/event-readiness";

export function EventWorkspace({
  activeTab,
  event,
  halls,
  onDirtyChange,
  onEventSaved,
  onTabChange
}: {
  activeTab: EventWorkspaceTab;
  event: EventFile;
  halls: EventHallOption[];
  /// Reported up so the page can stop a tab or event change from throwing away
  /// an unsaved draft.
  onDirtyChange: (isDirty: boolean) => void;
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
  const readiness = getEventReadinessSummary(event, "event");
  /**
   * Only what is actually true of this event. Three of the four chips that used
   * to sit here were literals with no data behind them, so they lit up on every
   * event forever - and a warning that is always on is one nobody reads. The
   * two with a real source survived; "Today notes unread" and "Needs review"
   * had none and are gone rather than faked.
   */
  const attention: Array<{ label: string; tab: EventWorkspaceTab }> = [];

  if (event.balance !== "Paid") {
    attention.push({ label: "Balance outstanding", tab: "Billing" });
  }

  if (!readiness.ready) {
    attention.push({
      label: `${readiness.total - readiness.completed} to finish`,
      tab: "Event details"
    });
  }

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
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone={lifecycleTone}>{lifecycleLabel}</Badge>
              <span className="text-xs font-normal text-[#6a7483]">
                {event.date} · {event.time} · {event.room}
              </span>
              {/* Off the Event details tab the checklist is out of sight, so a
                  compact meter keeps the remaining work visible everywhere. */}
              {activeTab === "Event details" ? null : (
                <button
                  className="inline-flex items-center gap-2 rounded-full px-2 py-0.5 text-xs font-medium text-[#516174] hover:bg-[#eef4fa]"
                  onClick={() => onTabChange("Event details")}
                  type="button"
                >
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-12 overflow-hidden rounded-full bg-[#eef1f5]"
                  >
                    <span
                      className={`block h-full rounded-full ${
                        readiness.ready ? "bg-[#12b76a]" : "bg-[#1f4d73]"
                      }`}
                      style={{
                        width: `${Math.round(
                          (readiness.completed / readiness.total) * 100
                        )}%`
                      }}
                    />
                  </span>
                  {readiness.ready
                    ? "Ready"
                    : `${readiness.completed} of ${readiness.total} ready`}
                </button>
              )}
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

      {attention.length && isWorkspaceExpanded ? (
        <div className="flex shrink-0 flex-wrap items-center gap-x-1 gap-y-1 border-b border-[#fedf89] bg-[#fffbeb] px-4 py-2 text-xs font-medium text-[#b54708]">
          {attention.map((item, index) => (
            <span key={item.label} className="inline-flex items-center gap-1">
              {index ? <span aria-hidden="true">·</span> : null}
              <button
                className="rounded underline underline-offset-2 hover:text-[#93370d]"
                onClick={() => onTabChange(item.tab)}
                type="button"
              >
                {item.label}
              </button>
            </span>
          ))}
        </div>
      ) : null}

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
            key={tab}
            aria-current={activeTab === tab ? "page" : undefined}
            className={`inline-flex h-11 shrink-0 items-center border-b-2 px-3 text-sm ${
              activeTab === tab
                ? "border-[#1f4d73] font-semibold text-[#17202a]"
                : "border-transparent font-normal text-[#516174] hover:bg-[#eef4fa] hover:text-[#17202a]"
            }`}
            type="button"
            onClick={(clickEvent) => {
              onTabChange(tab);
              centerMobileTab(clickEvent.currentTarget);
              setIsWorkspaceExpanded(true);
            }}
          >
            {tab}
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
              <div className="space-y-3">
                <EventInformation
                  event={event}
                  halls={halls}
                  onDirtyChange={onDirtyChange}
                  onEventSaved={onEventSaved}
                />
                <TimelineInstructions event={event} />
                <EventActivityHistory event={event} />
              </div>
              <aside className="space-y-3">
                <ClientContact event={event} />
                <ReadinessPanel event={event} onOpenTab={onTabChange} />
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
        {activeTab === "Hall map" ? <HallMapContent event={event} /> : null}
        {activeTab === "Kitchen" ? <EventKitchenContent event={event} /> : null}
        {activeTab === "Vendors" ? <EventVendorsContent /> : null}
        {activeTab === "Files" ? <EventFilesContent /> : null}
        {![
          "Event details",
          "Menu",
          "Client portal",
          "Billing",
          "Hall map",
          "Kitchen",
          "Vendors",
          "Files"
        ].includes(activeTab) ? (
          <EventTabPlaceholder label={activeTab} />
        ) : null}
      </div>
    </section>
  );
}
