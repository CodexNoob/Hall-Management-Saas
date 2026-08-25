import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The invitation flow's ordering contract.
 *
 * An invited account exists in our database with no `supabase_auth_id` - the
 * invitation writes the user row, Supabase writes the auth user, and only
 * POST /api/auth/session ever links the two. Everything else resolves its caller
 * by `supabase_auth_id`, so whichever call the card makes FIRST decides whether
 * an invitee can finish signing up at all. Getting it wrong answers 403 "User
 * account is not provisioned." with the Supabase password already changed, which
 * reads to the user as "my password did not save" when in fact it did.
 */

const replace = vi.fn();
const refresh = vi.fn();
const getSession = vi.fn();
const updateUser = vi.fn();
const fetchAuthSession = vi.fn();
const markPasswordSet = vi.fn();
const clearCachedAuthSession = vi.fn();

/** Every auth call the submit path makes, in the order it made them. */
const calls: string[] = [];

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh, push: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams("flow=invite")
}));

vi.mock("@/lib/supabase/browser", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/supabase/browser")>()),
  createSupabaseBrowserClient: () => ({ auth: { getSession, updateUser } })
}));

vi.mock("@/lib/auth/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/client")>();

  return {
    ...actual,
    fetchAuthSession: (...args: unknown[]) => fetchAuthSession(...args),
    markPasswordSet: (...args: unknown[]) => markPasswordSet(...args),
    clearCachedAuthSession: () => clearCachedAuthSession()
  };
});

import { SetPasswordCard } from "@/features/auth/components/set-password-card";

const PASSWORD = "Invitee!2026";

async function submitPassword() {
  render(<SetPasswordCard />);

  // The card reads the link's session before it enables the form.
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: /save password and continue/i })
    ).not.toHaveAttribute("disabled")
  );

  fireEvent.change(screen.getByLabelText("New Password"), {
    target: { value: PASSWORD }
  });
  fireEvent.change(screen.getByLabelText("Confirm Password"), {
    target: { value: PASSWORD }
  });
  fireEvent.submit(screen.getByRole("button", { name: /save password/i }));
}

describe("SetPasswordCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calls.length = 0;

    getSession.mockResolvedValue({
      data: { session: { access_token: "invite-token" } },
      error: null
    });
    updateUser.mockImplementation(async () => {
      calls.push("supabase.updateUser");
      return { error: null };
    });
    fetchAuthSession.mockImplementation(async (_token, options) => {
      calls.push(options?.force ? "session:force" : "session");
      return {};
    });
    markPasswordSet.mockImplementation(async () => {
      calls.push("password-set");
    });
  });

  /**
   * The regression itself. `markPasswordSet` used to run first, which is the one
   * order an invitee cannot survive.
   */
  it("syncs the account before recording the password", async () => {
    await submitPassword();

    await waitFor(() => expect(markPasswordSet).toHaveBeenCalled());

    expect(calls).toEqual([
      "supabase.updateUser",
      "session",
      "password-set",
      "session:force"
    ]);
  });

  /**
   * Unforced, so an already-synced caller - the `flow=required` prompt, a
   * recovery link opened in a signed-in browser - pays nothing for the invitee's
   * round trip. A fresh cache for the same subject is proof the row is claimed.
   */
  it("lets a fresh cached session satisfy the sync", async () => {
    await submitPassword();

    await waitFor(() => expect(fetchAuthSession).toHaveBeenCalledTimes(2));

    expect(fetchAuthSession.mock.calls[0]).toEqual(["invite-token"]);
  });

  /**
   * The forced refetch is what clears `mustSetPassword`. Without it the
   * dashboard gate reads a cache that still says the password is missing and
   * bounces the user back to this card.
   */
  it("refreshes the cached session after the write", async () => {
    await submitPassword();

    await waitFor(() => expect(replace).toHaveBeenCalled());

    expect(clearCachedAuthSession).toHaveBeenCalled();
    expect(fetchAuthSession).toHaveBeenLastCalledWith("invite-token", {
      force: true
    });
  });

  /**
   * A sync failure has to reach the user verbatim: "your access has been
   * removed" is the answer, and the generic fallback would hide it.
   */
  it("surfaces why the sync refused the account", async () => {
    fetchAuthSession.mockRejectedValueOnce(
      new Error("Your access to this organization has been removed.")
    );

    await submitPassword();

    await waitFor(() =>
      expect(
        screen.getByText("Your access to this organization has been removed.")
      ).toBeTruthy()
    );
    expect(markPasswordSet).not.toHaveBeenCalled();
  });
});
