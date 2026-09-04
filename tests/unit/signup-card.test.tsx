import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const refresh = vi.fn();
const signUp = vi.fn();
const fetchAuthSession = vi.fn();
const signInWithOAuthProvider = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh, replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(window.location.search)
}));

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({ auth: { signUp } })
}));

vi.mock("@/lib/auth/client", () => ({
  fetchAuthSession: (...args: unknown[]) => fetchAuthSession(...args),
  signInWithOAuthProvider: (...args: unknown[]) =>
    signInWithOAuthProvider(...args)
}));

import { ToastProvider } from "@/components/ui/toast";
import { SignUpCard } from "@/features/auth/components/signup-card";
import { AUTH_ERROR_MESSAGES } from "@/lib/auth/auth-error-messages";
import { MAX_PASSWORD_LENGTH } from "@/lib/auth/password";

const fetchMock = vi.fn();

function renderSignUp() {
  return render(
    <ToastProvider>
      <SignUpCard />
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
  // Through the form, so the native type="email" guard cannot mask the
  // component's own validation.
  const button = screen.getByRole("button", { name: "Create account" });
  fireEvent.submit(button.closest("form")!);
}

/** Every sign-up failure renders twice: inline and as a toast. */
function expectReportedTwice(message: string) {
  return waitFor(() => expect(screen.getAllByText(message)).toHaveLength(2));
}

function signUpFailure(error: Record<string, unknown>) {
  return { data: { user: null, session: null }, error };
}

describe("SignUpCardfailure paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Sign-up talks to Supabase and nothing else. The stub stays so that a
    // reintroduced pre-flight request shows up here rather than silently
    // hitting the network - see the no-HTTP assertion in the success path.
    vi.stubGlobal("fetch", fetchMock);
    signUp.mockResolvedValue({
      data: { user: { id: "user-1" }, session: null },
      error: null
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("asks for an email before touching the network", async () => {
    renderSignUp();
    submitForm();

    await expectReportedTwice("Please enter your email address.");
    expect(screen.getByText("Sign-up failed")).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("blocks a malformed address before it reaches Supabase", async () => {
    renderSignUp();
    fill("not-an-email", "Testing12345");
    submitForm();

    await expectReportedTwice(AUTH_ERROR_MESSAGES.invalidEmail);
    expect(signUp).not.toHaveBeenCalled();
  });

  it("rejects a password shorter than eight characters", async () => {
    renderSignUp();
    fill("owner@example.com", "short1");
    submitForm();

    await expectReportedTwice("Use at least 8 characters.");
    expect(signUp).not.toHaveBeenCalled();
  });

  it("rejects a password with no number", async () => {
    renderSignUp();
    fill("owner@example.com", "passwordonly");
    submitForm();

    await expectReportedTwice("Include at least one number.");
    expect(signUp).not.toHaveBeenCalled();
  });

  it("rejects a password with no letter", async () => {
    renderSignUp();
    fill("owner@example.com", "12345678");
    submitForm();

    await expectReportedTwice("Include at least one letter.");
    expect(signUp).not.toHaveBeenCalled();
  });

  it("rejects a password past the bcrypt limit before any email is sent", async () => {
    renderSignUp();
    fill("owner@example.com", `a1${"x".repeat(MAX_PASSWORD_LENGTH)}`);
    submitForm();

    await expectReportedTwice(
      `Passwords cannot be longer than ${MAX_PASSWORD_LENGTH} characters.`
    );
    expect(signUp).not.toHaveBeenCalled();
  });

  it("tells an existing owner to sign in instead of creating a duplicate", async () => {
    signUp.mockResolvedValue(
      signUpFailure({
        code: "user_already_exists",
        status: 400,
        message: "User already registered"
      })
    );
    renderSignUp();
    fill("owner@example.com", "Testing12345");
    submitForm();

    await expectReportedTwice(AUTH_ERROR_MESSAGES.emailAlreadyRegistered);
    // Must not look like success by landing on the confirm-email page.
    expect(push).not.toHaveBeenCalled();
  });

  it("reports Supabase's own weak-password rejection", async () => {
    signUp.mockResolvedValue(
      signUpFailure({ code: "weak_password", status: 422 })
    );
    renderSignUp();
    fill("owner@example.com", "Testing12345");
    submitForm();

    await expectReportedTwice(AUTH_ERROR_MESSAGES.weakPassword);
  });

  it("explains that sign-ups are closed", async () => {
    signUp.mockResolvedValue(signUpFailure({ code: "signup_disabled" }));
    renderSignUp();
    fill("owner@example.com", "Testing12345");
    submitForm();

    await expectReportedTwice(AUTH_ERROR_MESSAGES.signUpDisabled);
  });

  it("separates email-send throttling from a rejected account", async () => {
    signUp.mockResolvedValue(
      signUpFailure({ code: "over_email_send_rate_limit" })
    );
    renderSignUp();
    fill("owner@example.com", "Testing12345");
    submitForm();

    await expectReportedTwice(AUTH_ERROR_MESSAGES.emailSendRateLimited);
  });

  it("keeps the owner on the form when the network throws", async () => {
    signUp.mockRejectedValue(new TypeError("Failed to fetch"));
    renderSignUp();
    fill("owner@example.com", "Testing12345");
    submitForm();

    await expectReportedTwice("Failed to fetch");
    expect(push).not.toHaveBeenCalled();
  });

  it("does not create two accounts from a double submit", async () => {
    let resolveSignUp: (value: unknown) => void = () => {};
    signUp.mockReturnValue(
      new Promise((resolve) => {
        resolveSignUp = resolve;
      })
    );
    renderSignUp();
    fill("owner@example.com", "Testing12345");
    submitForm();

    const pending = await screen.findByRole("button", {
      name: "Creating account..."
    });
    expect(pending).toBeDisabled();

    resolveSignUp({
      data: { user: { id: "user-1" }, session: null },
      error: null
    });
    await waitFor(() => expect(signUp).toHaveBeenCalledTimes(1));
  });
});

describe("SignUpCardsuccess path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("trims the address before creating the account", async () => {
    signUp.mockResolvedValue({
      data: { user: { id: "user-1" }, session: null },
      error: null
    });
    renderSignUp();
    fill("  owner@example.com  ", "Testing12345");
    submitForm();

    await waitFor(() => expect(signUp).toHaveBeenCalled());

    // Supabase treats the surrounding whitespace as part of the address, so an
    // untrimmed value creates an account that can never be signed in to.
    const [payload] = signUp.mock.calls[0];
    expect(payload.email).toBe("owner@example.com");
  });

  /**
   * The two destinations, and which one is normal.
   *
   * Confirming the address comes FIRST, before anything is queued and before
   * the approval inbox hears a word. Registering used to skip straight to
   * /beta-pending and announce the address from here, which told the team about
   * people who never proved they could read mail at the address they typed.
   */
  it("sends an unconfirmed applicant to the verify-email page", async () => {
    signUp.mockResolvedValue({
      data: { user: { id: "user-1" }, session: null },
      error: null
    });
    renderSignUp();
    fill("owner+trial@example.com", "Testing12345");
    submitForm();

    // Carrying the address is what lets that page offer a resend, and it is the
    // one they just typed - unlike /beta-pending, which says the same thing to
    // everybody precisely so it cannot be asked whether an address is known.
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        "/verify-email?email=owner%2Btrial%40example.com"
      )
    );
    expect(fetchAuthSession).not.toHaveBeenCalled();
  });

  it("sends an already-confirmed applicant to the dashboard gate", async () => {
    signUp.mockResolvedValue({
      data: { session: { access_token: "access-token" } },
      error: null
    });
    renderSignUp();
    fill("owner@example.com", "Testing12345");
    submitForm();

    await waitFor(() => expect(signUp).toHaveBeenCalled());

    // The only signal that authorizes the server to provision an organization -
    // once the request behind it has been approved.
    const [payload] = signUp.mock.calls[0];
    expect(payload.options.data.account_type).toBe("organization_owner");
    // No query string of its own: the email template appends
    // `?token_hash=...&type=signup`, and a second `?` would break the link.
    expect(payload.options.emailRedirectTo).toMatch(/\/auth\/confirm$/);

    // Not signed in from here. The layout syncs the session, provisioning
    // records the request and refuses it, and /beta-pending is reached from
    // there rather than guessed at here.
    expect(fetchAuthSession).not.toHaveBeenCalled();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard/new"));
  });

  it("records nothing over HTTP while the address is unconfirmed", async () => {
    // The whole point of moving the recording into `provisionOwner`: an address
    // that is typed and abandoned must never reach the queue or the approval
    // inbox. A reintroduced POST from this form shows up as a failure here.
    signUp.mockResolvedValue({
      data: { user: { id: "user-1" }, session: null },
      error: null
    });
    renderSignUp();
    fill("owner@example.com", "Testing12345");
    submitForm();

    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("SignUpCard social sign-up", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signInWithOAuthProvider.mockReturnValue(new Promise(() => {}));
  });

  it("hands Google off without touching the email sign-up", async () => {
    // Identical to the call /login makes - one button signs in and signs up,
    // and where the organization comes from is decided by whether the identity
    // is already known, not by which page was open.
    renderSignUp();

    fireEvent.click(
      screen.getByRole("button", { name: /Continue with Google/ })
    );

    await waitFor(() =>
      expect(signInWithOAuthProvider).toHaveBeenCalledWith("google")
    );
    expect(signUp).not.toHaveBeenCalled();
  });

  it("reports a provider failure and re-enables the button", async () => {
    signInWithOAuthProvider.mockRejectedValue(new Error(""));
    renderSignUp();

    fireEvent.click(
      screen.getByRole("button", { name: /Continue with Google/ })
    );

    await expectReportedTwice("Unable to start social sign-up.");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Continue with Google/ })
      ).toBeEnabled()
    );
  });
});
