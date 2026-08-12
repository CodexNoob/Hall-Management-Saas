import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
const refresh = vi.fn();
const getSession = vi.fn();
const syncSignedInUser = vi.fn();
const createSupabaseBrowserClient = vi.fn(() => ({ auth: { getSession } }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh, push: vi.fn(), prefetch: vi.fn() })
}));

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => createSupabaseBrowserClient()
}));

vi.mock("@/lib/auth/client", () => ({
  syncSignedInUser: (...args: unknown[]) => syncSignedInUser(...args)
}));

/**
 * readAuthCallbackParams memoizes the URL at module scope so the Supabase client
 * cannot strip the fragment out from under it, so each case needs a fresh module
 * registry rather than just a new render.
 */
async function renderCallback(hash: string) {
  window.location.hash = hash;
  vi.resetModules();
  const { default: AuthCallbackPage } = await import("@/app/auth/callback/page");

  // The page resolves its session check in an effect, so let that settle inside
  // act rather than leaving React to warn about an unwrapped state update.
  await act(async () => {
    render(<AuthCallbackPage />);
  });
}

describe("AuthCallbackPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("explains an expired invitation instead of reporting a missing session", async () => {
    await renderCallback(
      "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired"
    );

    expect(
      await screen.findByText(/this link has expired or was already used/i)
    ).toBeTruthy();
    expect(screen.queryByText(/no active supabase session/i)).toBeNull();
  });

  it("does not ask Supabase for a session the rejected link never created", async () => {
    await renderCallback(
      "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired"
    );

    await waitFor(() => expect(screen.getByText(/expired/i)).toBeTruthy());
    expect(createSupabaseBrowserClient).not.toHaveBeenCalled();
    expect(getSession).not.toHaveBeenCalled();
  });

  it("offers sign in rather than a retry that would resend the dead token", async () => {
    await renderCallback(
      "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired"
    );

    expect(
      await screen.findByRole("link", { name: "Go to sign in" })
    ).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("keeps the retry button for a failure that is not an expired link", async () => {
    await renderCallback(
      "#error=server_error&error_code=unexpected_failure&error_description=Database+error+saving+new+user"
    );

    expect(
      await screen.findByText("Database error saving new user")
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Go to sign in" })).toBeNull();
  });

  it("still hands a valid invite link off to password setup", async () => {
    getSession.mockResolvedValue({
      data: { session: { access_token: "access-token" } },
      error: null
    });

    await renderCallback("#access_token=access-token&type=invite");

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/set-password?flow=invite")
    );
    expect(syncSignedInUser).not.toHaveBeenCalled();
  });

  it("reports a missing session when the URL carries no error to explain it", async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null });

    await renderCallback("");

    expect(
      await screen.findByText(/no active supabase session was found/i)
    ).toBeTruthy();
  });
});
