"use client";

import { useState } from "react";
import { ClientPortalPreviewDrawer } from "@/features/events/components/client-portal-preview-drawer";
import { PrintPacketDrawer } from "@/features/events/components/print-packet-drawer";
import { centerMobileTab } from "@/lib/ui/center-mobile-tab";
import { EventBillingContent } from "@/features/events/components/event-billing-content";
import { ClientPortalContent } from "@/features/events/components/event-client-portal-content";
import {
  ClientContact,
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
  type EventWorkspaceTab
} from "@/features/events/components/event-manager-shared";

export function EventWorkspace({ event }: { event: EventFile }) {
  const [activeTab, setActiveTab] =
    useState<EventWorkspaceTab>("Event details");
  const [isEventDetailsExpanded, setIsEventDetailsExpanded] = useState(true);
  const [isPrintPacketOpen, setIsPrintPacketOpen] = useState(false);
  const [isPortalPreviewOpen, setIsPortalPreviewOpen] = useState(false);

  return (
    <section className="flex h-auto w-full min-w-0 max-w-full flex-col overflow-x-hidden overflow-y-visible rounded-lg border border-[#d8dde5] bg-[#fbfcfd] xl:h-full xl:overflow-hidden">
      <header className="shrink-0 border-b border-[#d8dde5] bg-white p-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <LineIcon name="calendar" />
              <h1 className="truncate text-xl font-black text-[#17202a]">
                {event.title}
              </h1>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone="green">Confirmed</Badge>
              <Badge tone="gold">Open balance {event.balance}</Badge>
              <Badge tone="gold">Today notes unread</Badge>
              <Badge tone="gold">Needs review</Badge>
            </div>
          </div>
          <div className="grid w-full shrink-0 grid-cols-2 gap-2 sm:ml-auto sm:flex sm:w-auto sm:flex-nowrap sm:items-center sm:justify-end">
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
        event={{ title: event.title, date: event.date, room: event.room }}
        onClose={() => setIsPrintPacketOpen(false)}
        open={isPrintPacketOpen}
      />
      <ClientPortalPreviewDrawer
        event={{
          title: event.title,
          date: event.date,
          room: event.room,
          balance: event.balance
        }}
        onClose={() => setIsPortalPreviewOpen(false)}
        open={isPortalPreviewOpen}
      />

      <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-[#d8dde5] bg-white px-3">
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
              setActiveTab(tab.label);
              centerMobileTab(clickEvent.currentTarget);
              if (tab.label === "Event details") {
                setIsEventDetailsExpanded(true);
              }
            }}
          >
            <LineIcon name={tab.icon} className="h-3.5 w-3.5 text-[#516174]" />
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="min-h-0 w-full min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-visible p-3 xl:overflow-y-auto">
        {activeTab === "Event details" ? (
          <div className="min-w-0">
            <button
              aria-expanded={isEventDetailsExpanded}
              className="mb-3 flex min-h-11 w-full items-center justify-between rounded-lg border border-[#d8dde5] bg-white px-3 text-left text-sm font-black text-[#17202a] xl:hidden"
              onClick={() =>
                setIsEventDetailsExpanded((isExpanded) => !isExpanded)
              }
              type="button"
            >
              <span className="flex items-center gap-2">
                <LineIcon name="calendar" />
                Event details
              </span>
              <LineIcon
                name="chevron"
                className={`h-4 w-4 transition-transform ${
                  isEventDetailsExpanded ? "rotate-90" : ""
                }`}
              />
            </button>
            <div
              className={`min-w-0 gap-3 overflow-hidden xl:grid xl:grid-cols-[minmax(0,1fr)_336px] ${
                isEventDetailsExpanded ? "grid" : "hidden"
              }`}
            >
              <div className="space-y-3">
                <EventInformation event={event} />
                <TimelineInstructions />
              </div>
              <aside className="space-y-3">
                <ClientContact />
                <ReadinessPanel />
              </aside>
            </div>
          </div>
        ) : null}

        {activeTab === "Menu" ? <EventMenuContent /> : null}
        {activeTab === "Client portal" ? (
          <ClientPortalContent event={event} />
        ) : null}
        {activeTab === "Billing" ? <EventBillingContent /> : null}
        {activeTab === "Hall map" ? <HallMapContent /> : null}
        {activeTab === "Kitchen" ? <EventKitchenContent /> : null}
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
