import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { KitchenHeader } from "@/features/kitchen/components/kitchen-header";

describe("Kitchen full-screen sidebar control", () => {
  it("toggles the sidebar from the former Main Menu position", () => {
    const toggleSidebar = vi.fn();
    window.addEventListener("dashboard-mobile-sidebar-toggle", toggleSidebar);

    render(
      <KitchenHeader
        activeView="today"
        anchorDate={new Date(2026, 7, 28)}
        isOnToday
        notificationCount={0}
        onChangeView={vi.fn()}
        onNext={vi.fn()}
        onPrevious={vi.fn()}
        onToday={vi.fn()}
        onTodayNotes={vi.fn()}
        today={new Date(2026, 7, 28)}
      />
    );

    expect(
      screen.queryByRole("link", { name: "Main Menu" })
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open sidebar" }));
    expect(toggleSidebar).toHaveBeenCalledOnce();

    fireEvent(
      window,
      new CustomEvent("dashboard-mobile-sidebar-change", {
        detail: { open: true }
      })
    );
    fireEvent.click(screen.getByRole("button", { name: "Close sidebar" }));
    expect(toggleSidebar).toHaveBeenCalledTimes(2);

    window.removeEventListener(
      "dashboard-mobile-sidebar-toggle",
      toggleSidebar
    );
  });
});
