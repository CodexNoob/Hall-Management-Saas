import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  KitchenEventPanel,
  KitchenEventDetailsDialog,
  KitchenEventPreview
} from "@/features/kitchen/components/kitchen-event-details-dialog";
import type { KitchenEvent } from "@/features/kitchen/components/kitchen-shared";
import { TodayView } from "@/features/kitchen/components/kitchen-today-view";

function kitchenEvent(id: string, clientName: string, dishName: string): KitchenEvent {
  const line = {
    id: `${id}-line`,
    menuItemId: `${id}-item`,
    addOnId: null,
    kind: "Dish" as const,
    itemKind: "Food",
    name: dishName,
    pictureUrl: null,
    serviceStyle: "Plated",
    availableStyles: ["Plated"],
    notes: null,
    sortOrder: 0,
    isRetired: false,
    quantityMultiplier: 1,
    quantities: [],
    unresolvedBases: [],
    countState: "NoRule" as const,
    status: null,
    assignedWorkerId: null,
    assignedWorkerName: null
  };

  return {
    id,
    source: "booking",
    category: "Main Hall",
    title: clientName,
    clientName,
    eventType: "Wedding",
    status: "Confirmed",
    statusType: "kitchen",
    startsAt: null,
    totalGuests: 115,
    menuStatus: "Confirmed",
    otherMeals: [],
    summary: {
      dishes: 1,
      addOns: 0,
      complete: 0,
      pending: 0,
      notStarted: 1,
      assigned: 0,
      assignedToCurrentWorker: 0,
      needsAttention: 1,
      unresolvedBases: []
    },
    sheet: {
      meal: "Main",
      otherMeals: [],
      menuStatus: "Confirmed",
      confirmedAt: null,
      version: 1,
      counts: {
        totalGuests: 115,
        couples: 0,
        men: 115,
        ladies: 0,
        boys: 0,
        girls: 0,
        kids: 0,
        waiters: 0,
        tables: null
      },
      lines: [line],
      summary: {
        dishes: 1,
        addOns: 0,
        complete: 0,
        pending: 0,
        notStarted: 1,
        assigned: 0,
        assignedToCurrentWorker: 0,
        needsAttention: 1,
        unresolvedBases: []
      }
    },
    version: 1
  };
}

describe("Today's inline kitchen events", () => {
  it("shows every event and its dishes directly without opening a dialog", () => {
    const events = [
      kitchenEvent("event-a", "Feferkorn A", "Baked eggplant"),
      kitchenEvent("event-b", "Feferkorn B", "Japanese noodles")
    ];

    render(
      <TodayView
        day={{
          dateKey: "2026-09-02",
          dayName: "Wednesday",
          dateLabel: "Sep 2",
          dayNumber: 2,
          events
        }}
        renderEvent={(event) => (
          <KitchenEventPanel
            event={event}
            isSaving={false}
            onClose={vi.fn()}
            onSaveItemAction={vi.fn()}
            permissions={{
              canAssignWorkers: true,
              canUpdateKitchenStatus: true,
              canAddKitchenEvents: true,
              canCancelEvents: true,
              seesWholeBoard: true
            }}
            workers={[]}
          />
        )}
      />
    );

    expect(screen.getByText("Feferkorn A")).toBeInTheDocument();
    expect(screen.getByText("Baked eggplant")).toBeInTheDocument();
    expect(screen.getByText("Feferkorn B")).toBeInTheDocument();
    expect(screen.getByText("Japanese noodles")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Close kitchen event details" })
    ).toBeNull();
  });
});

describe("Week kitchen event previews", () => {
  it("crops a fixed-size preview and opens the full event when clicked", () => {
    const event = kitchenEvent(
      "event-week",
      "Feferkorn Week",
      "Baked apples"
    );
    const onOpen = vi.fn();

    render(
      <KitchenEventPreview
        event={event}
        isSaving={false}
        onClose={vi.fn()}
        onOpen={onOpen}
        onRemoveEvent={vi.fn()}
        onSaveItemAction={vi.fn()}
        permissions={{
          canAssignWorkers: true,
          canUpdateKitchenStatus: true,
          canAddKitchenEvents: true,
          canCancelEvents: true,
          seesWholeBoard: true
        }}
        workers={[]}
      />
    );

    const openButton = screen.getByRole("button", {
      name: "Open Feferkorn Week kitchen event"
    });
    expect(openButton.parentElement).toHaveClass(
      "h-36",
      "w-full",
      "overflow-hidden"
    );
    expect(screen.getByText("Baked apples")).toHaveClass("text-xs");
    expect(screen.getByText("Feferkorn Week")).toHaveClass(
      "overflow-hidden",
      "[overflow-wrap:anywhere]"
    );
    expect(screen.getByText("Delete Event")).toHaveClass("absolute", "bottom-2");

    fireEvent.click(openButton);

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("opens the week event as a chromeless blue production sheet", () => {
    const onClose = vi.fn();
    render(
      <KitchenEventDetailsDialog
        chromeless
        event={kitchenEvent("event-popup", "Feferkorn Popup", "Baked apples")}
        isSaving={false}
        onClose={onClose}
        onSaveItemAction={vi.fn()}
        permissions={{
          canAssignWorkers: true,
          canUpdateKitchenStatus: true,
          canAddKitchenEvents: true,
          canCancelEvents: true,
          seesWholeBoard: true
        }}
        workers={[]}
      />
    );

    expect(screen.getByRole("dialog")).toHaveClass(
      "max-w-5xl",
      "bg-[#dceaff]"
    );
    expect(
      screen.queryByRole("button", { name: "Close kitchen event details" })
    ).toBeNull();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
