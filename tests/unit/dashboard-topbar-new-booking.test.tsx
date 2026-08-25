import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), replace: vi.fn() })
}));

import { DashboardTopbar } from "@/components/layout/dashboard-topbar";
import { cacheTestSession, starterPermissionsExcept } from "./auth-session-fixture";

describe("DashboardTopbar New booking button", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("is disabled for a viewer without canCreateBooking", () => {
    cacheTestSession(starterPermissionsExcept("viewer", ["booking.create"], []));
    render(<DashboardTopbar onNewBooking={vi.fn()} title="Dashboard" />);
    expect(
      screen.getByRole("button", { name: "Create new booking" })
    ).toBeDisabled();
  });

  it("is enabled for a role whose access row has canCreateBooking", () => {
    cacheTestSession(["booking.create"]);
    render(<DashboardTopbar onNewBooking={vi.fn()} title="Dashboard" />);
    expect(
      screen.getByRole("button", { name: "Create new booking" })
    ).not.toBeDisabled();
  });

  it("is disabled for an administrative key set that lacks it", () => {
    // There is no administrator bypass here, because there is no administrator
    // concept anywhere. Holding 59 of the 62 keys does not stand in for holding
    // this one - which is the whole point of asking about a key rather than
    // about who somebody is.
    cacheTestSession(starterPermissionsExcept("administrator", ["booking.create"], []));
    render(<DashboardTopbar onNewBooking={vi.fn()} title="Dashboard" />);
    expect(
      screen.getByRole("button", { name: "Create new booking" })
    ).toBeDisabled();
  });
});
