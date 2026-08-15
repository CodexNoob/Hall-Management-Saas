import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/http/authenticated-fetch", () => ({
  authenticatedFetch: vi.fn()
}));

import { NewBookingDialog } from "@/features/bookings/forms/new-booking-dialog";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";
import { cacheTestSession } from "./auth-session-fixture";

const lookupResponse = {
  halls: [{ id: "hall-1", name: "Grand Hall" }],
  eventTypes: [{ id: "type-1", name: "Wedding" }],
  packages: []
};

describe("NewBookingDialog permission gating", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(authenticatedFetch).mockReset();
    vi.mocked(authenticatedFetch).mockResolvedValue(
      new Response(JSON.stringify(lookupResponse), { status: 200 })
    );
  });

  it("disables both submit buttons and explains why when the viewer lacks canCreateBooking", async () => {
    cacheTestSession("viewer", { canCreateBooking: false });
    render(<NewBookingDialog onClose={vi.fn()} open />);

    await waitFor(() =>
      expect(screen.getByRole("option", { name: "Wedding" })).toBeInTheDocument()
    );
    fireEvent.change(screen.getByLabelText("Event type"), {
      target: { value: "Wedding" }
    });

    expect(screen.getByRole("button", { name: "Save booking" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Create proposal" })
    ).toBeDisabled();
    expect(
      screen.getByText(/do not have permission to create bookings/i)
    ).toBeInTheDocument();
  });

  it("never fires the create-booking request even if the form is force-submitted", async () => {
    cacheTestSession("viewer", { canCreateBooking: false });
    render(<NewBookingDialog onClose={vi.fn()} open />);

    await waitFor(() =>
      expect(screen.getByRole("option", { name: "Wedding" })).toBeInTheDocument()
    );

    const callsBeforeSubmit = vi.mocked(authenticatedFetch).mock.calls.length;
    fireEvent.change(screen.getByLabelText("Client name"), {
      target: { value: "Test Client" }
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Save booking" }).closest("form")!
    );

    expect(vi.mocked(authenticatedFetch).mock.calls.length).toBe(
      callsBeforeSubmit
    );
  });

  it("enables submission once the role has canCreateBooking", async () => {
    cacheTestSession("manager", { canCreateBooking: true });
    render(<NewBookingDialog onClose={vi.fn()} open />);

    await waitFor(() =>
      expect(screen.getByRole("option", { name: "Wedding" })).toBeInTheDocument()
    );
    fireEvent.change(screen.getByLabelText("Event type"), {
      target: { value: "Wedding" }
    });

    expect(
      screen.getByRole("button", { name: "Save booking" })
    ).not.toBeDisabled();
    expect(
      screen.queryByText(/do not have permission to create bookings/i)
    ).not.toBeInTheDocument();
  });
});
