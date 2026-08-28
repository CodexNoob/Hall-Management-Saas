import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { KitchenNotificationsDrawer } from "@/features/kitchen/components/kitchen-notifications-drawer";

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

  it("confirms before clearing notifications", () => {
    const onClearNotifications = vi.fn();
    const confirm = vi
      .spyOn(window, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
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
