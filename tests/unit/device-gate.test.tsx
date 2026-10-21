import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authenticatedFetch } = vi.hoisted(() => ({ authenticatedFetch: vi.fn() }));

vi.mock("@/lib/http/authenticated-fetch", () => ({ authenticatedFetch }));

import { DeviceGate } from "@/features/auth/components/device-gate";

const json = (ok: boolean, body: unknown) => ({ ok, json: async () => body });

beforeEach(() => {
  vi.clearAllMocks();
});

function renderGate(pendingConfirmation = true) {
  const onConfirmed = vi.fn();
  const onSignOut = vi.fn();

  render(
    <DeviceGate
      onConfirmed={onConfirmed}
      onSignOut={onSignOut}
      pendingConfirmation={pendingConfirmation}
    />
  );

  return { onConfirmed, onSignOut };
}

describe("DeviceGate", () => {
  it("explains why the dashboard is not open, and what to do if it was not you", () => {
    renderGate();

    expect(
      screen.getByText("We need to confirm this device before opening your dashboard.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("If this was not you, reset your password and contact your administrator.")
    ).toBeInTheDocument();
  });

  it("confirms with the emailed code, then hands back to reload the session", async () => {
    authenticatedFetch.mockResolvedValue(json(true, { trusted: true }));
    const { onConfirmed } = renderGate();

    fireEvent.change(screen.getByLabelText("Code from the email"), {
      target: { value: "482913" }
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Confirm device" }));
    });

    expect(authenticatedFetch).toHaveBeenCalledWith("/api/me/devices/confirm", {
      method: "POST",
      body: JSON.stringify({ code: "482913" })
    });
    expect(onConfirmed).toHaveBeenCalled();
    expect(screen.getByText("This device is confirmed.")).toBeInTheDocument();
  });

  it("shows the server's reason when the code is wrong, and stays on the gate", async () => {
    authenticatedFetch.mockResolvedValue(
      json(false, { error: "That code is not right. Check the email and try again." })
    );
    const { onConfirmed } = renderGate();

    fireEvent.change(screen.getByLabelText("Code from the email"), {
      target: { value: "000000" }
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Confirm device" }));
    });

    expect(onConfirmed).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("That code is not right");
  });

  it("disables resend while the cooldown runs", async () => {
    authenticatedFetch.mockResolvedValue(
      json(true, {
        sentTo: "a•••@example.com",
        resendAvailableAt: new Date(Date.now() + 60_000).toISOString()
      })
    );
    renderGate();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Resend confirmation" }));
    });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Resend in/ })).toBeDisabled()
    );
  });

  it("offers to send a code when none went out for this sign-in", () => {
    renderGate(false);

    expect(screen.getByRole("button", { name: "Send code" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Code from the email")).toBeNull();
  });

  it("can sign out instead", () => {
    const { onSignOut } = renderGate();

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(onSignOut).toHaveBeenCalled();
  });
});
