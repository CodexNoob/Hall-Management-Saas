import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OtherSessionsPanel } from "@/features/settings/components/other-sessions-panel";

const mocks = vi.hoisted(() => ({
  sessions: [] as unknown[],
  refetch: vi.fn(),
  replace: vi.fn(),
  authenticatedFetch: vi.fn(),
  signOutCurrentSession: vi.fn()
}));

// The panel routes to /login when the caller signs out of every session,
// including this browser - so it holds a router now.
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    prefetch: vi.fn(),
    push: vi.fn(),
    replace: mocks.replace,
    refresh: vi.fn()
  })
}));

vi.mock("@/lib/http/authenticated-fetch", () => ({
  authenticatedFetch: mocks.authenticatedFetch
}));

vi.mock("@/lib/auth/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/client")>()),
  signOutCurrentSession: mocks.signOutCurrentSession
}));

vi.mock("@/features/dashboard/hooks/use-authenticated-query", () => ({
  useAuthenticatedQuery: () => ({
    data: { sessions: mocks.sessions },
    error: null,
    isLoading: false,
    isFetching: false,
    refetch: mocks.refetch
  })
}));

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: "row-1",
    device: "Chrome on Windows",
    ipAddress: "203.0.113.9",
    city: "Manila",
    country: "PH",
    createdAt: "2026-09-20T10:00:00.000Z",
    lastSeenAt: "2026-09-25T10:00:00.000Z",
    current: false,
    ...overrides
  };
}

describe("OtherSessionsPanel location", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sessions = [];
  });

  it("names the country rather than showing its code", () => {
    // The row stores ISO 3166-1 alpha-2 so it can be read in whichever
    // language the viewer chose; "PH" on screen would be the storage format
    // leaking into the UI.
    mocks.sessions = [session()];
    render(<OtherSessionsPanel />);

    expect(screen.getByText(/Manila, Philippines/)).toBeTruthy();
    expect(screen.queryByText(/Manila, PH\b/)).toBeNull();
  });

  /**
   * The case that reads as a broken feature.
   *
   * `city` and `country` come from edge headers, and nothing sits in front of
   * `next dev` to set them - so in local development every row has no place on
   * it. Omitting the segment made that indistinguishable from the location
   * never having been built, which is exactly how it was reported.
   */
  it("says so when no location resolved, instead of dropping the field", () => {
    mocks.sessions = [session({ city: null, country: null })];
    render(<OtherSessionsPanel />);

    expect(screen.getByText(/Location unavailable/)).toBeTruthy();
  });

  it("shows the half it has when only one of the two resolved", () => {
    // Cloudflare sets a country and no city, so a partial reading is normal
    // rather than a broken one.
    mocks.sessions = [session({ city: null })];
    render(<OtherSessionsPanel />);

    expect(screen.getByText(/Philippines/)).toBeTruthy();
    expect(screen.queryByText(/Location unavailable/)).toBeNull();
  });

  /**
   * A button per row, and none on the row you are sitting at.
   *
   * The current session's row already says "This device", and the control for
   * leaving the browser you are holding is Logout in the sidebar. A second one
   * here, in a column of other people's phones, is the mis-click it looks like.
   */
  it("offers a sign-out button on every session except this device", () => {
    mocks.sessions = [
      session({ id: "row-1", device: "Chrome on Windows" }),
      session({ id: "row-2", device: "Safari on iPhone" }),
      session({ id: "row-3", device: "Firefox on macOS", current: true })
    ];
    render(<OtherSessionsPanel />);

    expect(screen.getAllByRole("button", { name: "Sign out" })).toHaveLength(2);
  });

  it("names every device and the one you are on", () => {
    mocks.sessions = [
      session({ id: "row-1" }),
      session({ id: "row-2", current: true })
    ];
    render(<OtherSessionsPanel />);

    expect(screen.getByText("This device")).toBeTruthy();
  });

  /**
   * "All devices" ends EVERY session, this browser included - so it says so.
   * Changing what a button does while leaving it labelled "everywhere else"
   * is how somebody signs themselves out of the laptop they are holding on the
   * strength of a sentence that promised they would not be.
   */
  it("says that signing out all devices includes this device", () => {
    mocks.sessions = [session()];
    render(<OtherSessionsPanel />);

    expect(
      screen.getByRole("button", { name: "Sign out all devices" })
    ).toBeTruthy();
    expect(screen.getByText(/including this one/i)).toBeTruthy();
  });

  /**
   * A trusted secondary is labelled trusted. Before, only the primary carried
   * a badge, so the trusted device somebody was using looked untrusted.
   */
  it("labels every trusted device, and adds Primary only to the primary", () => {
    mocks.sessions = [
      session({ id: "row-1", device: "Chrome on Windows", trustedDevice: true, primaryDevice: true }),
      session({ id: "row-2", device: "Safari on iPhone", trustedDevice: true, primaryDevice: false }),
      session({ id: "row-3", device: "Firefox on macOS", trustedDevice: false })
    ];
    render(<OtherSessionsPanel />);

    const rowFor = (device: string) =>
      screen.getByText(device).closest("li") as HTMLElement;

    expect(within(rowFor("Chrome on Windows")).getByText("Trusted")).toBeTruthy();
    expect(within(rowFor("Chrome on Windows")).getByText("Primary")).toBeTruthy();
    expect(within(rowFor("Safari on iPhone")).getByText("Trusted")).toBeTruthy();
    expect(within(rowFor("Safari on iPhone")).queryByText("Primary")).toBeNull();
    expect(within(rowFor("Firefox on macOS")).queryByText("Trusted")).toBeNull();
  });

  it("signs out all devices, then leaves for sign-in", async () => {
    mocks.sessions = [session()];
    mocks.authenticatedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ revoked: true, endedCurrentSession: true })
    });
    mocks.signOutCurrentSession.mockResolvedValue(undefined);
    render(<OtherSessionsPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Sign out all devices" }));
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Sign out all devices"
      })
    );

    await waitFor(() => expect(mocks.replace).toHaveBeenCalled());
    expect(mocks.authenticatedFetch).toHaveBeenCalledWith(
      "/api/me/sessions?scope=all-devices",
      { method: "DELETE" }
    );
    expect(mocks.signOutCurrentSession).toHaveBeenCalled();
    expect(mocks.replace.mock.calls[0]?.[0]).toContain("/login");
  });

  it("falls back to the stored code rather than throwing on a malformed one", () => {
    // `Intl.DisplayNames.of` raises RangeError on anything that is not a
    // well-formed region subtag, and an unrenderable row would take the whole
    // panel down with it - so a bad value is shown as itself.
    mocks.sessions = [session({ city: null, country: "X" })];
    render(<OtherSessionsPanel />);

    expect(screen.queryByText(/Location unavailable/)).toBeNull();
    expect(screen.getByText(/\bX\b/)).toBeTruthy();
  });
});
