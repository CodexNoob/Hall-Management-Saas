import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: null as unknown,
  authenticatedFetch: vi.fn(),
  refreshAuthorization: vi.fn()
}));

vi.mock("@/features/dashboard/hooks/use-dashboard-permission", () => ({
  useAuthSession: () => mocks.session
}));

vi.mock("@/lib/http/authenticated-fetch", () => ({
  authenticatedFetch: mocks.authenticatedFetch
}));

vi.mock("@/lib/auth/authorization-refresh", () => ({
  refreshAuthorization: mocks.refreshAuthorization
}));

import { ProfileSharedDeviceField } from "@/components/forms/profile-shared-device-field";

/**
 * THE EXEMPTION THAT KEEPS THE KITCHEN BOARD ON.
 *
 * A screen mounted on a wall is unattended by design, and the inactivity
 * timeout would sign it out mid-service. This is the control that stops that -
 * and the reason it is in the profile dialog rather than in Settings is that
 * the person setting up a board is a kitchen manager, who holds no
 * `settings.read` and cannot open Settings at all.
 */

const withTimeout = (overrides: Record<string, unknown> = {}) => ({
  inactivity: { timeoutMinutes: 480, sharedDevice: false, ...overrides }
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session = withTimeout();
  mocks.authenticatedFetch.mockResolvedValue({ ok: true });
  mocks.refreshAuthorization.mockResolvedValue(undefined);
});

describe("when an inactivity timeout applies", () => {
  it("offers the exemption", () => {
    render(<ProfileSharedDeviceField />);

    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(screen.getByText(/kitchen board/i)).toBeTruthy();
  });

  it("reflects a device that is already marked", () => {
    mocks.session = withTimeout({ sharedDevice: true });
    render(<ProfileSharedDeviceField />);

    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("marks this device when ticked", async () => {
    render(<ProfileSharedDeviceField />);
    fireEvent.click(screen.getByRole("checkbox"));

    await waitFor(() =>
      expect(mocks.authenticatedFetch).toHaveBeenCalledWith(
        "/api/me/activity",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ sharedDevice: true })
        })
      )
    );
  });

  it("unmarks it when unticked", async () => {
    mocks.session = withTimeout({ sharedDevice: true });
    render(<ProfileSharedDeviceField />);
    fireEvent.click(screen.getByRole("checkbox"));

    await waitFor(() =>
      expect(mocks.authenticatedFetch).toHaveBeenCalledWith(
        "/api/me/activity",
        expect.objectContaining({
          body: JSON.stringify({ sharedDevice: false })
        })
      )
    );
  });

  /**
   * The flag rides the session, so re-reading it is what actually stops the
   * countdown on this device. Without this the box would tick and the warning
   * dialog would still appear an hour later.
   */
  it("re-reads the session so the countdown stops", async () => {
    render(<ProfileSharedDeviceField />);
    fireEvent.click(screen.getByRole("checkbox"));

    await waitFor(() =>
      expect(mocks.refreshAuthorization).toHaveBeenCalledWith({ force: true })
    );
  });

  it("says so when it could not be saved", async () => {
    mocks.authenticatedFetch.mockResolvedValue({ ok: false });
    render(<ProfileSharedDeviceField />);
    fireEvent.click(screen.getByRole("checkbox"));

    expect(await screen.findByRole("alert")).toBeTruthy();
  });
});

describe("when no timeout applies", () => {
  /**
   * A switch that exempts you from a policy nobody has set changes nothing the
   * person can observe, and invites the question "is this working?".
   */
  it("draws nothing when the venue turned the timeout off", () => {
    mocks.session = withTimeout({ timeoutMinutes: 0 });
    const { container } = render(<ProfileSharedDeviceField />);

    expect(container).toBeEmptyDOMElement();
  });

  it("draws nothing for a session that predates the feature", () => {
    mocks.session = {};
    const { container } = render(<ProfileSharedDeviceField />);

    expect(container).toBeEmptyDOMElement();
  });

  it("draws nothing when there is no session at all", () => {
    mocks.session = null;
    const { container } = render(<ProfileSharedDeviceField />);

    expect(container).toBeEmptyDOMElement();
  });
});
