import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { KitchenNotificationsDrawer } from "@/features/kitchen/components/kitchen-notifications-drawer";

const cookNotification = {
  id: "notification-1",
  title: "Menu Changed",
  description: "The menu changed.",
  event: "Wedding",
  hall: "Main Hall",
  date: "Aug 28, 2026",
  oldValue: "Old",
  newValue: "New",
  by: "Manager",
  when: "Today",
  acknowledged: false,
  emailSent: "Email sent 8/27/2026, 9:00:00 PM",
  changeSummary: {
    afterStatus: "Confirmed",
    beforeStatus: "Confirmed",
    meal: "Main",
    items: [{ name: "Roast chicken", type: "Dish", serviceStyle: "Plated" }]
  }
};

describe("KitchenNotificationsDrawer", () => {
  it("shows an acknowledgment failure inside the drawer", () => {
    render(
      <KitchenNotificationsDrawer
        acknowledgmentError="Could not acknowledge notification."
        notifications={[]}
        onAcknowledge={vi.fn()}
        onAcknowledgeAll={vi.fn()}
        onClearNotifications={vi.fn()}
        onClose={vi.fn()}
        open
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not acknowledge notification."
    );
  });

  it("shows bulk actions without the old stats or filters", () => {
    render(
      <KitchenNotificationsDrawer
        seesWholeKitchen
        notifications={[
          {
            id: "notification-1",
            title: "Menu Changed",
            description: "The menu changed.",
            event: "Wedding",
            hall: "Main Hall",
            date: "Aug 28, 2026",
            oldValue: "Old",
            newValue: "New",
            by: "Manager",
            when: "Today",
            acknowledged: false
          }
        ]}
        onAcknowledge={vi.fn()}
        onAcknowledgeAll={vi.fn()}
        onClearNotifications={vi.fn()}
        onClose={vi.fn()}
        open
      />
    );

    expect(
      screen.getByRole("button", { name: "Acknowledge all" })
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Clear notifications" })
    ).toBeVisible();
    expect(screen.queryByText("Total")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "All" })
    ).not.toBeInTheDocument();
  });

  // A cook is sent only the notifications for events they are cooking on, and
  // the API refuses their acknowledge-all and clear with a 403. Rendering the
  // controls anyway would offer them a sweep of a feed they are only shown part
  // of, and answer the click with an error.
  it("withholds the bulk actions from a scoped cook", () => {
    render(
      <KitchenNotificationsDrawer
        notifications={[
          {
            id: "notification-1",
            title: "Menu Changed",
            description: "The menu changed.",
            event: "Wedding",
            hall: "Main Hall",
            date: "Aug 28, 2026",
            oldValue: "Old",
            newValue: "New",
            by: "Manager",
            when: "Today",
            acknowledged: false,
            emailSent: "Email sent 8/27/2026, 9:00:00 PM",
            changeSummary: {
              afterStatus: "Confirmed",
              beforeStatus: "Confirmed",
              meal: "Main",
              items: [
                { name: "Roast chicken", type: "Dish", serviceStyle: "Plated" }
              ]
            }
          }
        ]}
        onAcknowledge={vi.fn()}
        onAcknowledgeAll={vi.fn()}
        onClearNotifications={vi.fn()}
        onClose={vi.fn()}
        open
      />
    );

    expect(
      screen.queryByRole("button", { name: "Acknowledge all" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Clear notifications" })
    ).not.toBeInTheDocument();
    // Their own notification is still theirs to acknowledge.
    expect(
      screen.getByRole("button", { name: "Acknowledge now" })
    ).toBeVisible();
  });

  // What a cook opens the drawer to ask is "has anything changed about my
  // work", so the answer is on the face of the card: which event, which day,
  // and the dishes now on it - none of it behind a toggle.
  it("puts the event and the dish list on the face of a cook's card", () => {
    render(
      <KitchenNotificationsDrawer
        notifications={[cookNotification]}
        onAcknowledge={vi.fn()}
        onAcknowledgeAll={vi.fn()}
        onClearNotifications={vi.fn()}
        onClose={vi.fn()}
        open
      />
    );

    expect(
      screen.getByText("Wedding · Main Hall · Aug 28, 2026")
    ).toBeVisible();
    expect(screen.getByText("Roast chicken")).toBeVisible();
    expect(screen.getByText(/Changed by/)).toHaveTextContent("Manager");
    expect(
      screen.getByText("Changes to the events you're cooking")
    ).toBeVisible();

    // The delivery receipt for the platform's own email is the supervisor's
    // business, and the raw before/after pair says nothing the message above
    // has not already said.
    expect(screen.queryByText(/Email:/)).not.toBeInTheDocument();
    // The clean summary's own Before/After tiles stay; what goes is the raw
    // fallback pair, which prints these two values verbatim.
    expect(screen.queryByText("Old")).not.toBeInTheDocument();
    expect(screen.queryByText("New")).not.toBeInTheDocument();
  });

  it("keeps the supervisor's ledger behind View changes", () => {
    render(
      <KitchenNotificationsDrawer
        notifications={[cookNotification]}
        onAcknowledge={vi.fn()}
        onAcknowledgeAll={vi.fn()}
        onClearNotifications={vi.fn()}
        onClose={vi.fn()}
        open
        seesWholeKitchen
      />
    );

    expect(
      screen.queryByText("Wedding · Main Hall · Aug 28, 2026")
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Roast chicken")).not.toBeInTheDocument();
    // Twice: on the card, and again in the copy only a screen reader hears.
    expect(screen.getAllByText(/Email:/)).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "View changes" }));
    expect(screen.getByText("Roast chicken")).toBeVisible();
    expect(screen.getByText("Hall")).toBeVisible();
  });

  // The list is narrowed to their dishes on the server. The card names the
  // remainder so a shortened list never reads as a smaller night.
  it("counts the dishes on the event that are not the cook's", () => {
    render(
      <KitchenNotificationsDrawer
        notifications={[
          {
            ...cookNotification,
            changeSummary: {
              ...cookNotification.changeSummary,
              otherItemCount: 6
            }
          }
        ]}
        onAcknowledge={vi.fn()}
        onAcknowledgeAll={vi.fn()}
        onClearNotifications={vi.fn()}
        onClose={vi.fn()}
        open
      />
    );

    expect(screen.getByText("Your dishes on this event")).toBeVisible();
    expect(screen.getByText("Roast chicken")).toBeVisible();
    expect(screen.getByText("and 6 other dishes on this event")).toBeVisible();
  });

  // Reachable on an older change: the cook holds a dish on this event today,
  // but the menu this notification recorded was somebody else's work entirely.
  it("says so when none of a change's dishes are the cook's", () => {
    render(
      <KitchenNotificationsDrawer
        notifications={[
          {
            ...cookNotification,
            changeSummary: {
              ...cookNotification.changeSummary,
              items: [],
              otherItemCount: 4
            }
          }
        ]}
        onAcknowledge={vi.fn()}
        onAcknowledgeAll={vi.fn()}
        onClearNotifications={vi.fn()}
        onClose={vi.fn()}
        open
      />
    );

    expect(
      screen.getByText("None of this event's 4 dishes are assigned to you.")
    ).toBeVisible();
  });

  it("tells a cook with nothing assigned that nothing is theirs", () => {
    render(
      <KitchenNotificationsDrawer
        notifications={[]}
        onAcknowledge={vi.fn()}
        onAcknowledgeAll={vi.fn()}
        onClearNotifications={vi.fn()}
        onClose={vi.fn()}
        open
      />
    );

    expect(screen.getByText(/Nothing here needs you/)).toBeVisible();
    expect(
      screen.queryByText("No kitchen notifications.")
    ).not.toBeInTheDocument();
  });

  it("confirms before clearing notifications", () => {
    const onClearNotifications = vi.fn();
    const confirm = vi
      .spyOn(window, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    render(
      <KitchenNotificationsDrawer
        seesWholeKitchen
        notifications={[
          {
            id: "notification-1",
            title: "Menu Changed",
            description: "The menu changed.",
            event: "Wedding",
            hall: "Main Hall",
            date: "Aug 28, 2026",
            oldValue: "Old",
            newValue: "New",
            by: "Manager",
            when: "Today",
            acknowledged: true
          }
        ]}
        onAcknowledge={vi.fn()}
        onAcknowledgeAll={vi.fn()}
        onClearNotifications={onClearNotifications}
        onClose={vi.fn()}
        open
      />
    );

    const clear = screen.getByRole("button", { name: "Clear notifications" });
    fireEvent.click(clear);
    expect(onClearNotifications).not.toHaveBeenCalled();
    fireEvent.click(clear);
    expect(onClearNotifications).toHaveBeenCalledOnce();
    confirm.mockRestore();
  });
});
