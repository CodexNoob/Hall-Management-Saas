import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), replace: vi.fn() })
}));

import { DashboardTopbar } from "@/components/layout/dashboard-topbar";
import { cacheSyncedUser } from "./synced-user-fixture";

describe("DashboardTopbar New booking button", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("is disabled for a viewer without canCreateBooking", () => {
    cacheSyncedUser("viewer", { canCreateBooking: false });
    render(<DashboardTopbar onNewBooking={vi.fn()} title="Dashboard" />);
    expect(
      screen.getByRole("button", { name: "Create new booking" })
    ).toBeDisabled();
  });

  it("is enabled for a role whose access row has canCreateBooking", () => {
    cacheSyncedUser("manager", { canCreateBooking: true });
    render(<DashboardTopbar onNewBooking={vi.fn()} title="Dashboard" />);
    expect(
      screen.getByRole("button", { name: "Create new booking" })
    ).not.toBeDisabled();
  });

  it("is enabled for an administrative role regardless of the access row", () => {
    cacheSyncedUser("admin", { canCreateBooking: false });
    render(<DashboardTopbar onNewBooking={vi.fn()} title="Dashboard" />);
    expect(
      screen.getByRole("button", { name: "Create new booking" })
    ).not.toBeDisabled();
  });
});
