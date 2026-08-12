import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), replace: vi.fn() })
}));

import { DashboardSidePanels } from "@/features/dashboard/components/dashboard-side-panels";
import { cacheSyncedUser } from "./synced-user-fixture";

describe("DashboardSidePanels Book event quick action", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("is disabled for a viewer without canCreateBooking", () => {
    cacheSyncedUser("viewer", { canCreateBooking: false });
    render(
      <DashboardSidePanels
        isLoading={false}
        onNewBooking={vi.fn()}
        rangeLabel="This week"
        timelineGroups={[]}
        totalEvents={0}
      />
    );
    expect(screen.getByRole("button", { name: "Book event" })).toBeDisabled();
  });

  it("is enabled for a role whose access row has canCreateBooking", () => {
    cacheSyncedUser("manager", { canCreateBooking: true });
    render(
      <DashboardSidePanels
        isLoading={false}
        onNewBooking={vi.fn()}
        rangeLabel="This week"
        timelineGroups={[]}
        totalEvents={0}
      />
    );
    expect(
      screen.getByRole("button", { name: "Book event" })
    ).not.toBeDisabled();
  });

  it("leaves unrelated quick actions (e.g. Kitchen board) enabled regardless of canCreateBooking", () => {
    cacheSyncedUser("viewer", { canCreateBooking: false });
    render(
      <DashboardSidePanels
        isLoading={false}
        onNewBooking={vi.fn()}
        rangeLabel="This week"
        timelineGroups={[]}
        totalEvents={0}
      />
    );
    expect(
      screen.getByRole("button", { name: "Kitchen board" })
    ).not.toBeDisabled();
  });
});
