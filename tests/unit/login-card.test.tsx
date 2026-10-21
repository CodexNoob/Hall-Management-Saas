import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MVP_LANDING_ROUTE } from "@/lib/ui/mvp-features";

const replace = vi.fn();
const refresh = vi.fn();
const signInWithPassword = vi.fn();
const getAuthenticatorAssuranceLevel = vi.fn();
const listFactors = vi.fn();
const challengeAndVerify = vi.fn();
const getSession = vi.fn();
const setAuthSessionPersistence = vi.fn();
const fetchAuthSession = vi.fn();
const signInWithOAuthProvider = vi.fn();
const signOutCurrentSession = vi.fn();

// useDesktopAppMode() calls useSearchParams(), so the mock has to provide it
// or every render throws.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh, push: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(window.location.search)
}));

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      signInWithPassword,
      getSession,
      mfa: {
        getAuthenticatorAssuranceLevel,
        listFactors,
        challengeAndVerify
      }
    }
  }),
  setAuthSessionPersistence: (...args: unknown[]) =>
    setAuthSessionPersistence(...args)
}));

// AuthSessionError and isTerminalAuthSessionError are the real ones: the whole
// point of the terminal-refusal branch is that it recognizes what the route
// actually returns, and a stubbed predicate would assert nothing.
vi.mock("@/lib/auth/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/client")>();

  return {
    AuthSessionError: actual.AuthSessionError,
    isTerminalAuthSessionError: actual.isTerminalAuthSessionError,
    fetchAuthSession: (...args: unknown[]) => fetchAuthSession(...args),
    signInWithOAuthProvider: (...args: unknown[]) =>
      signInWithOAuthProvider(...args),
    signOutCurrentSession: (...args: unknown[]) =>
      signOutCurrentSession(...args)
  };
});

import { ToastProvider } from "@/components/ui/toast";
import { AuthSessionError } from "@/lib/auth/client";
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

/**
 * The slice of POST /api/auth/session the sign-in form reads: what the SERVER
 * decided this sign-in owes. The form never asks Supabase's assurance level -
 * a trusted device that remembers the authenticator is `aal1` and owes nothing.
 */
function syncedSession(obligation: "satisfied" | "challenge" | "enroll") {
  return {
    mfa: { enrolled: obligation !== "enroll", requiredByOrganization: false, obligation }
  };
}

describe("LoginCard failure paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/login");
    signInWithPassword.mockResolvedValue(
      supabaseFailure({ code: "invalid_credentials", status: 400 })
    );
    fetchAuthSession.mockResolvedValue(syncedSession("satisfied"));
    signOutCurrentSession.mockResolvedValue(undefined);
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
    expect(fetchAuthSession).not.toHaveBeenCalled();
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

  it("ends the Supabase session when the account itself is refused", async () => {
    // Supabase authenticated the person and provisioning would not have them.
    // The session it minted is valid, and proxy.ts sends anyone holding one away
    // from /login - so leaving it behind this error message means the next
    // reload lands on a dashboard that refuses them, with no way back.
    signInWithPassword.mockResolvedValue({
      data: { session: { access_token: "access-token" } },
      error: null
    });
    fetchAuthSession.mockRejectedValue(
      new AuthSessionError(
        "No employee account was found for this email. Ask your organization administrator for an invitation.",
        403,
        "invitation_required"
      )
    );
    renderLogin();
    fill("stranger@example.com", "Secret123");
    submitForm();

    await expectReportedTwice(
      "No employee account was found for this email. Ask your organization administrator for an invitation."
    );
    await waitFor(() => expect(signOutCurrentSession).toHaveBeenCalledTimes(1));
    expect(replace).not.toHaveBeenCalled();
  });

  /**
   * A beta applicant signing in before they are approved.
   *
   * They typed the right password - there is nothing on this form for them to
   * correct - so a red message here reads as a mistake they made. They get the
   * page about the beta instead, with the session ended for the same reason as
   * the case above.
   */
  it("sends a pending beta applicant to the beta-pending page", async () => {
    signInWithPassword.mockResolvedValue({
      data: { session: { access_token: "access-token" } },
      error: null
    });
    fetchAuthSession.mockRejectedValue(
      new AuthSessionError(
        "Thank you for your interest in Event Core. Your beta access request has been received. We'll reach out when your account is approved.",
        403,
        "beta_access_pending"
      )
    );
    renderLogin();
    fill("applicant@example.com", "Secret123");
    submitForm();

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/beta-pending"));
    expect(signOutCurrentSession).toHaveBeenCalledTimes(1);
  });

  it("distinguishes a rejected applicant on the same page", async () => {
    signInWithPassword.mockResolvedValue({
      data: { session: { access_token: "access-token" } },
      error: null
    });
    fetchAuthSession.mockRejectedValue(
      new AuthSessionError(
        "This account has not been approved for Event Core access.",
        403,
        "beta_access_rejected"
      )
    );
    renderLogin();
    fill("applicant@example.com", "Secret123");
    submitForm();

    // A status CODE on the URL, never the server's prose: the page reads this
    // back off its own query string, where anyone could have typed it.
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/beta-pending?status=rejected")
    );
  });

  it("leaves the session alone when the refusal is only a server error", async () => {
    signInWithPassword.mockResolvedValue({
      data: { session: { access_token: "access-token" } },
      error: null
    });
    fetchAuthSession.mockRejectedValue(
      new AuthSessionError("Unable to sync the signed-in user.", 500)
    );
    renderLogin();
    fill("owner@example.com", "Secret123");
    submitForm();

    await expectReportedTwice("Unable to sync the signed-in user.");
    expect(signOutCurrentSession).not.toHaveBeenCalled();
  });

  it("explains why the dashboard sent the user back", async () => {
    window.history.replaceState({}, "", "/login?reason=invitation_required");
    renderLogin();

    expect(
      await screen.findByText(/No employee account was found for that email/)
    ).toBeInTheDocument();
  });

  it("ignores a reason code it does not recognize", async () => {
    // The value is attacker-supplied - anyone can type a ?reason= - so only
    // codes from the table may put text on the sign-in form.
    window.history.replaceState({}, "", "/login?reason=call+555+for+support");
    renderLogin();

    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    );
  });

  it("re-enables the Google button when the page comes back from the bfcache", async () => {
    signInWithOAuthProvider.mockReturnValue(new Promise(() => {}));
    renderLogin();

    fireEvent.click(
      screen.getByRole("button", { name: /Continue with Google/ })
    );
    expect(
      await screen.findByRole("button", { name: /Opening Google/ })
    ).toBeDisabled();

    // What the browser fires when Back restores this page with its React state
    // still intact, which would otherwise leave the button disabled forever.
    fireEvent(
      window,
      Object.assign(new Event("pageshow"), { persisted: true })
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Continue with Google/ })
      ).toBeEnabled()
    );
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
    // What the server says this sign-in owes. Nothing, by default.
    fetchAuthSession.mockResolvedValue(syncedSession("satisfied"));
  });

  afterEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("signs a valid employee in and lands on the dashboard", async () => {
    renderLogin();
    fill("owner@example.com", "Secret123");
    submitForm();

    await waitFor(() =>
      expect(fetchAuthSession).toHaveBeenCalledWith("access-token", {
        force: true
      })
    );
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(MVP_LANDING_ROUTE)
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("ignores a hostile next parameter", async () => {
    window.history.replaceState({}, "", "/login?next=//evil.com");
    renderLogin();
    fill("owner@example.com", "Secret123");
    submitForm();

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(MVP_LANDING_ROUTE)
    );
  });

  it("keeps the MFA challenge loading until the upgraded session is synced", async () => {
    let resolveSessionSync: () => void = () => {};
    // The password step's sync says a code is owed; the post-challenge sync
    // hangs until the test releases it.
    fetchAuthSession
      .mockResolvedValueOnce(syncedSession("challenge"))
      .mockReturnValueOnce(
        new Promise<void>((resolve) => {
          resolveSessionSync = resolve;
        })
      );
    listFactors.mockResolvedValue({
      data: { totp: [{ id: "factor-1", status: "verified" }] },
      error: null
    });
    challengeAndVerify.mockResolvedValue({ error: null });
    getSession.mockResolvedValue({
      data: { session: { access_token: "aal2-access-token" } }
    });

    renderLogin();
    fill("owner@example.com", "Secret123");
    submitForm();

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Authentication code"), {
      target: { value: "123456" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));

    await waitFor(() =>
      expect(fetchAuthSession).toHaveBeenCalledWith("aal2-access-token", {
        force: true
      })
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Verifying..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Login" })).toBeDisabled();

    submitForm();
    expect(signInWithPassword).toHaveBeenCalledTimes(1);

    resolveSessionSync();
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(MVP_LANDING_ROUTE)
    );
  });

  /**
   * A trusted device that remembers the authenticator. The account HAS a
   * factor and the session is `aal1`, yet the server says nothing is owed -
   * so no dialog. The form follows the server, never Supabase's assurance.
   */
  it("does not ask for the code when the server says this device remembers it", async () => {
    fetchAuthSession.mockResolvedValue(syncedSession("satisfied"));

    renderLogin();
    fill("owner@example.com", "Secret123");
    submitForm();

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(MVP_LANDING_ROUTE)
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(getAuthenticatorAssuranceLevel).not.toHaveBeenCalled();
  });

  it("asks for the code when the server says this sign-in owes it", async () => {
    fetchAuthSession.mockResolvedValue(syncedSession("challenge"));

    renderLogin();
    fill("owner@example.com", "Secret123");
    submitForm();

    // Found by its NAME: an unnamed dialog is unannounced to screen readers,
    // and the e2e sign-in helper looks it up exactly this way.
    expect(
      await screen.findByRole("dialog", { name: "Two-factor authentication" })
    ).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  /**
   * Enrolment is not a code to type at sign-in: the dashboard's gate takes the
   * person through protected set-up, and the server refuses everything else.
   */
  it("leaves enrolment to the dashboard gate", async () => {
    fetchAuthSession.mockResolvedValue(syncedSession("enroll"));

    renderLogin();
    fill("owner@example.com", "Secret123");
    submitForm();

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(MVP_LANDING_ROUTE)
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
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
