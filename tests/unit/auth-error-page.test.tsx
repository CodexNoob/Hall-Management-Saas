import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { AuthErrorView } from "@/features/auth/components/auth-error-view";
import type { AuthCallbackParams } from "@/lib/auth/auth-callback-params";

/**
 * Covers the copy that used to live on the client /auth/callback page. The
 * route handlers replaced that page, but the messages and the
 * expired-vs-retryable split are unchanged, and this is now the only thing that
 * renders them.
 */
function fromQuery(
  params: Partial<AuthCallbackParams> = {}
): AuthCallbackParams {
  return {
    type: null,
    errorCode: null,
    errorDescription: null,
    next: null,
    ...params
  };
}

beforeEach(() => {
  window.history.replaceState(null, "", "/auth/auth-error");
});

describe("AuthErrorView", () => {
  it("explains an expired link from the query string the handlers redirect with", () => {
    render(
      <AuthErrorView
        initial={fromQuery({
          errorCode: "otp_expired",
          errorDescription: "Email link is invalid or has expired"
        })}
      />
    );

    expect(
      screen.getByText(/this link has expired or was already used/i)
    ).toBeTruthy();
  });

  it("offers sign in rather than a retry that would resend the dead token", () => {
    render(<AuthErrorView initial={fromQuery({ errorCode: "otp_expired" })} />);

    expect(screen.getByRole("link", { name: "Go to sign in" })).toHaveAttribute(
      "href",
      "/login"
    );
    expect(
      screen.queryByRole("link", { name: "Email me a new link" })
    ).toBeNull();
  });

  it("offers a fresh link for a failure that is not an expired one", () => {
    render(
      <AuthErrorView
        initial={fromQuery({
          errorCode: "unexpected_failure",
          errorDescription: "Database error saving new user"
        })}
      />
    );

    expect(screen.getByText("Database error saving new user")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Email me a new link" })
    ).toHaveAttribute("href", "/forgot-password");
    expect(screen.queryByRole("link", { name: "Go to sign in" })).toBeNull();
  });

  /**
   * "Secure email change" confirms the first address without starting a
   * session. Without its own message this reads as an outright failure.
   */
  it("explains a confirmation that started no session", () => {
    render(
      <AuthErrorView
        initial={fromQuery({ errorCode: "confirmation_pending" })}
      />
    );

    expect(screen.getByText(/you are not signed in yet/i)).toBeTruthy();
  });

  it("falls back to actionable copy when the URL carries no reason", () => {
    render(<AuthErrorView initial={fromQuery()} />);

    expect(
      screen.getByText(/this sign-in link could not be verified/i)
    ).toBeTruthy();
  });

  /**
   * The reason this view has a client half at all. Supabase attaches its own
   * rejections to the fragment, which never reaches the server - so the first
   * render is necessarily the generic message, and the precise one can only
   * arrive after mount.
   */
  it("upgrades to a reason Supabase left in the fragment", async () => {
    window.history.replaceState(
      null,
      "",
      "/auth/auth-error#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired"
    );

    render(<AuthErrorView initial={fromQuery()} />);

    await waitFor(() =>
      expect(
        screen.getByText(/this link has expired or was already used/i)
      ).toBeTruthy()
    );
  });

  /**
   * Hydration safety: the first render must be exactly what the server sent,
   * or React discards the tree. A fragment-less URL must leave it untouched.
   */
  it("leaves the server-rendered message alone when there is no fragment", async () => {
    render(
      <AuthErrorView
        initial={fromQuery({ errorDescription: "Database error saving new user" })}
      />
    );

    await waitFor(() =>
      expect(screen.getByText("Database error saving new user")).toBeTruthy()
    );
  });
});
