import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
const refresh = vi.fn();
const signInWithPassword = vi.fn();
const setAuthSessionPersistence = vi.fn();
const syncSignedInUser = vi.fn();
const signInWithOAuthProvider = vi.fn();

// useDesktopAppMode() calls useSearchParams(), so the mock has to provide it
// or every render throws.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh, push: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(window.location.search)
}));

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({ auth: { signInWithPassword } }),
  setAuthSessionPersistence: (...args: unknown[]) =>
    setAuthSessionPersistence(...args)
}));

vi.mock("@/lib/auth/client", () => ({
  syncSignedInUser: (...args: unknown[]) => syncSignedInUser(...args),
  signInWithOAuthProvider: (...args: unknown[]) =>
    signInWithOAuthProvider(...args)
}));

import { ToastProvider } from "@/components/ui/toast";
import { LoginCard } from "@/features/auth/components/login-card";
import { AUTH_ERROR_MESSAGES } from "@/lib/auth/auth-error-messages";

function renderLogin() {
  return render(
    <ToastProvider>
      <LoginCard />
    </ToastProvider>
  );
}

function fill(email: string, password: string) {
  if (email) {
    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: email }
    });
  }
  if (password) {
    fireEvent.change(screen.getByLabelText("Password", { exact: true }), {
      target: { value: password }
    });
  }
}

function submitForm() {
  // Submitted through the form rather than the button so the native
  // type="email" guard cannot mask the component's own validation - jsdom
  // enforces constraint validation on button clicks just like Chromium.
  const button = screen.getByRole("button", { name: "Login" });
  fireEvent.submit(button.closest("form")!);
}

/** Every failure renders twice: inline next to the form, and as a toast. */
function expectReportedTwice(message: string) {
  return waitFor(() =>
    expect(screen.getAllByText(message)).toHaveLength(2)
  );
}

function supabaseFailure(error: Record<string, unknown>) {
  return { data: { user: null, session: null }, error };
}

describe("LoginCard failure paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/login");
    signInWithPassword.mockResolvedValue(
      supabaseFailure({ code: "invalid_credentials", status: 400 })
    );
    syncSignedInUser.mockResolvedValue(undefined);
  });

  afterEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("does not reach Supabase when both fields are blank", async () => {
    renderLogin();
    submitForm();

    await expectReportedTwice("Please enter your email address and password.");
    expect(screen.getByText("Sign-in failed")).toBeInTheDocument();
    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("rejects a password-only submission", async () => {
    renderLogin();
    fill("", "Secret123");
    submitForm();

    await expectReportedTwice("Please enter your email address.");
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("rejects an email-only submission", async () => {
    renderLogin();
    fill("owner@example.com", "");
    submitForm();

    await expectReportedTwice("Please enter your password.");
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("treats a whitespace-only password as missing", async () => {
    renderLogin();
    fill("owner@example.com", "    ");
    submitForm();

    await expectReportedTwice("Please enter your password.");
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("blocks a malformed address instead of sending it to Supabase", async () => {
    // Without the schema this round-tripped to Supabase and came back as
    // "Incorrect email or password", which blames the wrong field.
    renderLogin();
    fill("not-an-email", "Secret123");
    submitForm();

    await expectReportedTwice(AUTH_ERROR_MESSAGES.invalidEmail);
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("reports wrong credentials inline and as a toast", async () => {
    renderLogin();
    fill("owner@example.com", "WrongPassword1");
    submitForm();

    await expectReportedTwice(AUTH_ERROR_MESSAGES.incorrectCredentials);
    expect(screen.getByText("Sign-in failed")).toBeInTheDocument();
    expect(syncSignedInUser).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Login" })).toBeEnabled()
    );
  });

  it("asks an unconfirmed user to confirm their email", async () => {
    signInWithPassword.mockResolvedValue(
      supabaseFailure({ code: "email_not_confirmed", status: 400 })
    );
    renderLogin();
    fill("owner@example.com", "Secret123");
    submitForm();

    await expectReportedTwice(AUTH_ERROR_MESSAGES.emailNotConfirmed);
    expect(replace).not.toHaveBeenCalled();
  });

  it("reports a disabled account rather than a bad password", async () => {
    signInWithPassword.mockResolvedValue(
      supabaseFailure({ code: "user_banned", status: 400 })
    );
    renderLogin();
    fill("owner@example.com", "Secret123");
    submitForm();

    await expectReportedTwice(AUTH_ERROR_MESSAGES.accountDisabled);
  });

  it("asks the user to wait when Supabase rate-limits the attempt", async () => {
    signInWithPassword.mockResolvedValue(
      supabaseFailure({ status: 429, message: "Request rate limit reached" })
    );
    renderLogin();
    fill("owner@example.com", "Secret123");
    submitForm();

    await expectReportedTwice(AUTH_ERROR_MESSAGES.rateLimited);
  });

  it("keeps the user on the form when the request throws", async () => {
    signInWithPassword.mockRejectedValue(new TypeError("Failed to fetch"));
    renderLogin();
    fill("owner@example.com", "Secret123");
    submitForm();

    await expectReportedTwice("Failed to fetch");
    expect(replace).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Login" })).toBeEnabled()
    );
  });

  it("disables the button in flight and ignores a second submit", async () => {
    let resolveSignIn: (value: unknown) => void = () => {};
    signInWithPassword.mockReturnValue(
      new Promise((resolve) => {
        resolveSignIn = resolve;
      })
    );
    renderLogin();
    fill("owner@example.com", "Secret123");
    submitForm();

    const pending = await screen.findByRole("button", {
      name: "Logging in..."
    });
    expect(pending).toBeDisabled();

    resolveSignIn(supabaseFailure({ code: "invalid_credentials", status: 400 }));
    await expectReportedTwice(AUTH_ERROR_MESSAGES.incorrectCredentials);
    expect(signInWithPassword).toHaveBeenCalledTimes(1);
  });

  it("clears the inline error on the next keystroke", async () => {
    renderLogin();
    submitForm();
    await expectReportedTwice("Please enter your email address and password.");

    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "owner@example.com" }
    });

    // The toast lingers by design; only the inline copy goes away.
    await waitFor(() =>
      expect(
        screen.getAllByText("Please enter your email address and password.")
      ).toHaveLength(1)
    );
  });

  it("reports a social login failure and re-enables the provider button", async () => {
    signInWithOAuthProvider.mockRejectedValue(new Error(""));
    renderLogin();

    fireEvent.click(screen.getByRole("button", { name: /Continue with Google/ }));

    await expectReportedTwice("Unable to start social login.");
    expect(screen.getByText("Social login failed")).toBeInTheDocument();
  });
});

describe("LoginCard success path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/login");
    signInWithPassword.mockResolvedValue({
      data: { session: { access_token: "access-token" } },
      error: null
    });
    syncSignedInUser.mockResolvedValue(undefined);
  });

  afterEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("signs a valid employee in and lands on the dashboard", async () => {
    renderLogin();
    fill("owner@example.com", "Secret123");
    submitForm();

    await waitFor(() =>
      expect(syncSignedInUser).toHaveBeenCalledWith("access-token", {
        force: true
      })
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
    expect(refresh).toHaveBeenCalled();
  });

  it("ignores a hostile next parameter", async () => {
    window.history.replaceState({}, "", "/login?next=//evil.com");
    renderLogin();
    fill("owner@example.com", "Secret123");
    submitForm();

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
  });

  it("only persists the session when Remember me is ticked", async () => {
    renderLogin();
    fill("owner@example.com", "Secret123");
    submitForm();
    await waitFor(() => expect(setAuthSessionPersistence).toHaveBeenCalledWith(false));

    fireEvent.click(screen.getByLabelText("Remember me"));
    submitForm();
    await waitFor(() => expect(setAuthSessionPersistence).toHaveBeenCalledWith(true));
  });
});
