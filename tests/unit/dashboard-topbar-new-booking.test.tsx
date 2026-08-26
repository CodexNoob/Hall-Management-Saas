import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
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

  it("opens a booking dialog on a page that passes no handler", async () => {
    // `onNewBooking` is optional, and every page except Settings left it out -
    // so the button rendered wired to an undefined onClick and did nothing when
    // clicked, while the "+" on each calendar cell, which goes through the
    // page's own state, worked. The topbar now falls back to its own dialog.
    cacheTestSession(["booking.create"]);
    render(<DashboardTopbar title="Calendar" />);

    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Create new booking" }));

    expect(
      await screen.findByRole("dialog", { name: "New booking" })
    ).toBeInTheDocument();
  });

  it("leaves the booking dialog to the page when it supplies a handler", () => {
    // Settings and Calendar own a dialog and refresh themselves after a save.
    // Mounting the topbar's as well would give those pages two.
    cacheTestSession(["booking.create"]);
    const onNewBooking = vi.fn();
    render(<DashboardTopbar onNewBooking={onNewBooking} title="Calendar" />);

    fireEvent.click(screen.getByRole("button", { name: "Create new booking" }));

    expect(onNewBooking).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).toBeNull();
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
